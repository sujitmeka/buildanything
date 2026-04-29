# Product Spec

## App Overview

CraftMarket is a peer-to-peer marketplace where independent makers sell handmade goods directly to buyers, with the platform handling payments, dispute resolution, and seller payouts. The buyer experience prioritizes fast discovery and trust signals; the seller experience prioritizes order visibility and reliable payouts.

| Persona | Role | Primary JTBD | Relationship to Other Personas |
|---------|------|--------------|--------------------------------|
| Buyer (primary) | End consumer browsing and purchasing handmade goods | Find a trusted seller and complete a purchase in under three minutes | Buys from Seller; rates Seller post-transaction; can file dispute against Seller |
| Seller | Independent maker fulfilling orders | Receive, fulfill, and get paid for orders without manual chasing | Sells to Buyer; receives notifications from Buyer order events; can file dispute against Buyer |

## Screen Inventory

| Screen | Description | Features |
|--------|-------------|----------|
| Catalog | Searchable grid of products with filters | Product Discovery |
| Product Detail | Single product page with images, seller info, reviews | Product Discovery |
| Checkout (3 screens) | Cart review, shipping entry, order confirmation | Order Placement |
| Order Confirmation | Post-purchase success screen with order ID and ETA | Order Placement |
| Seller Order Inbox | List of incoming orders for the seller, sorted by urgency | Seller Fulfillment |
| Order Fulfillment Detail | Single-order view with buyer notes, address, fulfillment actions | Seller Fulfillment |
| Payout Dashboard | Pending and completed payouts with status timeline | Seller Fulfillment |
| Account Settings | Profile, payment methods, notification preferences | Shared (both personas) |

## Permissions & Roles

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| Anonymous | Browse catalog, view product detail, sign up | Place orders, contact sellers |
| Buyer | Place orders, leave reviews, file disputes, manage own cart | Access seller-only screens, view other buyers' orders |
| Seller | Manage own listings, view incoming orders, mark shipped, request payouts | Access other sellers' inboxes, view buyer payment details |
| Admin | Mediate disputes, suspend accounts, view platform analytics | Edit listing prices, place orders on behalf of buyers |

## Cross-Feature Interactions

- Product Discovery → Order Placement: clicking "Buy Now" on Product Detail seeds the cart with that item
- Order Placement (Buyer) → Seller Fulfillment (Seller): seller notified within 60s when buyer's order transitions to `processing → completed`
- Seller Fulfillment (Seller) → Order Placement (Buyer): buyer sees order status update when seller marks shipped
- Order Placement → Inventory: stock check at cart-review entry AND at order submit
- Seller Fulfillment → Payout: payout request enabled only after order marked shipped + 7-day buyer dispute window closes

## Feature: Product Discovery

### States
States: initial-empty (initial), loading-results, results-loaded, no-results, filter-active, error

### Transitions
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| initial-empty → loading-results | Page mount or search submit | Search query non-empty OR default catalog view | Fetch GET /api/products |
| loading-results → results-loaded | API 200 | Response has ≥ 1 product | Render grid, update result count |
| loading-results → no-results | API 200 | Response has 0 products | Show no-results state with suggested searches |
| loading-results → error | API 4xx/5xx or 10s timeout | — | Show error banner, preserve query |
| results-loaded → filter-active | User selects filter chip | At least one filter applied | Refetch with filter params |
| filter-active → results-loaded | User clears all filters | — | Refetch with no filter params |
| error → loading-results | Click "Retry" | — | Re-issue last query |

### Data Requirements
- loading-results: query string from URL params, no display data (skeleton state)
- results-loaded: list of products [{id, title, price, image_url, seller_id, seller_name, rating, in_stock}] from GET /api/products
- no-results: query string echoed back, list of 3 suggested searches from GET /api/products/suggestions
- filter-active: same as results-loaded plus active filter set [{type, value}]
- error: error message string from API or "We couldn't load products. Please try again."
- initial-empty: featured products list from GET /api/products?featured=true

### Failure Modes
- Search API timeout (10s) →
  User sees: "Search is taking longer than usual. Please try again."
  User can: Retry, clear search and browse featured products
  System: Log timeout with query, do NOT auto-retry

- Image CDN fails to serve product images →
  User sees: Gray placeholder with product title overlaid; product is still selectable
  User can: Click through to product detail anyway
  System: Log CDN failure, fall back to lower-resolution image URL on retry

- Filter combination yields zero results →
  User sees: "No products match these filters. Try removing a filter or adjusting your search."
  User can: Click "Clear filters" CTA, remove individual filter chips
  System: Preserve search query, only clear filter state

### Business Rules
- Default page size: 24 products per page, infinite scroll loads next page at 80% scroll depth
- Search debounce: 300ms after last keystroke before issuing API call
- Filter combinations: AND across filter types, OR within a filter type (e.g. `category=ceramics AND (color=blue OR color=green)`)
- Sort default: relevance for keyword search, newest-first for category browse
- Out-of-stock visibility: [DECISION NEEDED: Show out-of-stock items in results with a badge, or filter them out by default? Suggest: show with "Sold out" badge, ranked last]
- Cache: GET /api/products responses cached client-side for 60s keyed on query+filters

### Happy Path
1. User lands on Catalog screen. Sees: 24 featured products in a grid, search bar at top, filter sidebar with category/price/color. Can: type search query, click filter chip, click product card.
2. User types "ceramic mug" in search. Sees: results refresh after 300ms debounce, result count "47 products" appears, grid updates. Can: refine search, apply filters, click product.
3. User clicks "Color: blue" filter chip. Sees: grid refreshes, result count drops to 12, blue chip shown as active. Can: add more filters, clear filter, click product.
4. User clicks a product card. Navigates to Product Detail screen. Sees: large image carousel, price, seller name with rating, "Add to Cart" CTA, reviews section.

### Persona Constraints
- Persona: Buyer (primary) — time-poor, scans, doesn't read [ux-research.md]
  Constraint: search results must render first paint in under 1.5s on 4G — buyers in interviews abandoned searches that felt sluggish [ux-research.md]
  Constraint: filter chips must be one-tap to apply and one-tap to remove — multi-step filter modals had 40% drop-off in v0 [feature-intel.md]

### Empty/Loading/Error States
- Loading: Skeleton grid of 24 placeholder cards matching final layout dimensions, no spinner.
- No results: "No products match '{query}'. Try a different search or browse our categories." with 3 suggested category links.
- Error: "We couldn't load products right now. Please try again." with "Retry" button. Inline within results area, not full-page.
- Initial empty (no search yet): Featured products grid with section header "Discover handmade goods."

### Acceptance Criteria
- [ ] Verify that search results render first paint in under 1.5 seconds on a 4G connection
- [ ] Verify that applying a filter updates the result count and grid without a full page reload
- [ ] Verify that out-of-stock items display a "Sold out" badge and are ranked last in results
- [ ] Verify that the no-results state suggests 3 alternative searches based on the failed query
- [ ] Verify that infinite scroll loads the next page at 80% scroll depth without a visible loading interruption

## Feature: Order Placement

### States
States: empty-cart (initial), cart-review, entering-shipping, confirming, processing, completed, failed

### Transitions
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| empty-cart → cart-review | Add first item from Product Detail | User authenticated as Buyer | Create cart in local storage |
| cart-review → entering-shipping | Click "Continue to Shipping" | Cart has ≥ 1 in-stock item | Validate inventory via GET /api/inventory/check |
| cart-review → empty-cart | Remove last item | — | Clear cart from local storage |
| entering-shipping → confirming | Submit shipping form | All required fields valid, address verified | Calculate tax via POST /api/tax/calculate |
| confirming → processing | Click "Place Order" | — | POST /api/orders, disable button, show spinner |
| processing → completed | API 201 | Order created server-side | Show confirmation, send email, clear cart, notify seller |
| processing → failed | API 4xx/5xx or 30s timeout | — | Show error message, re-enable "Place Order" |
| failed → processing | Click "Try Again" | Poll GET /api/orders/{idempotency_key} confirms no order exists | Retry POST /api/orders |
| failed → cart-review | Click "Review Cart" | — | Navigate back, cart preserved |

### Data Requirements
- cart-review: cart items [{id, name, price, quantity, image_url, seller_id}] from local storage, inventory status from GET /api/inventory/check
- entering-shipping: saved addresses from GET /api/user/addresses (if any), country list static
- confirming: order summary {items, subtotal, shipping, tax, total} computed client-side, tax from POST /api/tax/calculate
- processing: idempotency key generated client-side, no display data beyond spinner
- completed: order {id, estimated_delivery, email, seller_name} from POST /api/orders response
- failed: error message from API response body, idempotency key preserved for retry
- empty-cart: no data, static copy

### Failure Modes
- Inventory check fails because item went out of stock after carting →
  User sees: "'{item name}' is no longer available from {seller name}. We've removed it from your cart."
  User can: Continue with remaining items, or go back to browse
  System: Remove item from cart, recalculate total, do NOT block checkout if other items remain

- Shipping address verification fails →
  User sees: Inline field-level errors ("Enter a valid ZIP code", "Street address not found")
  User can: Correct fields and resubmit
  System: No tax API call until address validation passes client-side

- Payment authorization declined →
  User sees: "Your payment was declined. Please check your card details or try a different payment method."
  User can: Retry, change payment method, go back to cart
  System: Log decline reason, do NOT create order, do NOT charge card, preserve cart

- Network failure during order submit →
  User sees: "Connection lost. Your cart is saved — try again when you're back online."
  User can: Retry once connection is restored
  System: Cart persisted in local storage, idempotency key preserved, no server-side order created

- 30s timeout during processing →
  User sees: "This is taking longer than expected. Please wait or try again."
  User can: Wait or click "Try Again"
  System: If order was created server-side, poll GET /api/orders/{idempotency_key} to confirm before retrying — never double-charge

### Business Rules
- Discount codes: one per order, validated in real-time via POST /api/discounts/validate
- Tax: calculated by jurisdiction based on shipping address, displayed at confirmation step
- Inventory: checked at cart-review entry AND at order submit — stale items removed with notification
- Minimum order: no minimum
- Shipping: flat $5.99, free over $50 subtotal
- Order timeout: 30 seconds before showing timeout message
- Cart persistence: local storage, survives browser close, expires after 7 days
- Idempotency: every POST /api/orders includes a client-generated idempotency key, retries reuse the same key
- Seller payout SLA: [DECISION NEEDED: How long after delivery confirmation does the seller payout release? Suggest: 7 days post-shipment OR 2 days post-delivery confirmation, whichever comes first]

### Happy Path
1. User is on cart-review screen. Sees: item list with names, prices, quantities, seller names per item, subtotal. Can: edit quantities (inline +/- buttons), remove items, apply discount code, click "Continue to Shipping."
2. User clicks "Continue to Shipping." Sees: shipping form with saved addresses (if any) or empty form. Required fields: name, street, city, state, ZIP, country. Can: select saved address or enter new one.
3. User submits shipping. Sees: order confirmation screen with full summary — items, subtotal, shipping cost, tax, total. Can: edit any section (back navigation preserves all data), click "Place Order."
4. User clicks "Place Order." Sees: button disabled, inline spinner, "Processing your order..." text. Waits up to 10 seconds.
5. Order succeeds. Sees: confirmation page with order ID, estimated delivery, seller name, "A confirmation email has been sent to {email}." Can: click "Continue Shopping" or view order in account.

### Persona Constraints
- Persona: Buyer (primary) — time-poor, scans, doesn't read [ux-research.md]
  Constraint: checkout must complete in 3 steps maximum — competitors average 5+, each extra step costs ~10% conversion [feature-intel.md, ux-research.md]
  Constraint: show progress indicator at top of every checkout step — buyers in usability tests abandoned without visible progress [ux-research.md]
  Constraint: real-time discount code validation — competing marketplaces require page reload, this is a key differentiator [feature-intel.md]
- Persona: Seller — needs immediate visibility into incoming orders to plan fulfillment [ux-research.md, feature-intel.md]
  Constraint: order notification must fire within 60s of buyer's `processing → completed` transition — sellers reported losing time-sensitive custom orders to faster-notifying platforms [ux-research.md]
  Constraint: order payload to seller must include buyer-supplied notes verbatim with no truncation — fulfillment errors traced to truncated notes in v0 research [ux-research.md]

### Empty/Loading/Error States
- Empty cart: "Your cart is empty. Browse our makers to find something handmade." CTA: "Browse Catalog" linking to Product Discovery.
- Loading inventory check: Cart items dimmed, "Checking availability..." text below cart.
- Loading tax calculation: Subtotal visible, tax line shows "Calculating..." with shimmer placeholder.
- Loading order processing: "Place Order" button disabled, inline spinner, "Processing your order..." text.
- Error generic: "Something went wrong. Please try again." with "Retry" button. Inline within checkout flow, never a full-page error.

### Acceptance Criteria
- [ ] Verify that checkout completes in 3 steps (cart review, shipping, confirmation)
- [ ] Verify that user can navigate back to any previous step without losing entered data
- [ ] Verify that discount code validates in real-time without a page reload
- [ ] Verify that out-of-stock items detected during checkout show inline notification with the specific item name
- [ ] Verify that payment failure shows specific error copy with retry option, not a generic error page
- [ ] Verify that the seller is notified within 60 seconds of order confirmation
- [ ] Verify that order confirmation displays order ID, ETA, and triggers a confirmation email
- [ ] Verify that 30s timeout uses the idempotency key to avoid double-charging on retry

## Feature: Seller Fulfillment

### States
States: inbox-empty (initial), inbox-loaded, order-detail, marking-shipped, shipped-confirmed, payout-pending, payout-released, error

### Transitions
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| inbox-empty → inbox-loaded | Inbox page mount with new orders present | Seller authenticated | Fetch GET /api/seller/orders |
| inbox-loaded → order-detail | Click order row | Order belongs to seller | Fetch GET /api/seller/orders/{id} |
| order-detail → marking-shipped | Click "Mark Shipped" + enter tracking number | Tracking number non-empty, valid carrier format | POST /api/seller/orders/{id}/ship |
| marking-shipped → shipped-confirmed | API 200 | — | Update order status, notify buyer, start payout countdown |
| marking-shipped → error | API 4xx/5xx | — | Show inline error, preserve tracking input |
| shipped-confirmed → payout-pending | 7-day buyer dispute window opens | No dispute filed within window | Payout queued in seller dashboard |
| payout-pending → payout-released | Payout cron job runs | Dispute window closed, no holds | Transfer funds, send seller email |

### Data Requirements
- inbox-loaded: orders [{id, buyer_name, items_summary, total, placed_at, status, urgency_flag}] from GET /api/seller/orders
- order-detail: full order {id, buyer_name, shipping_address, items[], buyer_notes, total, status, placed_at} from GET /api/seller/orders/{id}
- marking-shipped: tracking_number (input), carrier (dropdown), no display data beyond confirmation modal
- shipped-confirmed: same as order-detail with status now "shipped" and tracking_number visible
- payout-pending: payouts [{order_id, amount, eligible_at, status}] from GET /api/seller/payouts
- payout-released: same as payout-pending plus paid_at timestamp and bank reference

### Failure Modes
- Order API fetch fails on inbox load →
  User sees: "We couldn't load your orders. Please refresh." with refresh button
  User can: Click refresh, contact support
  System: Log failure, do NOT clear any cached order data — show last successful fetch with stale indicator

- Tracking number rejected by carrier validation →
  User sees: Inline error "This tracking number doesn't match the {carrier} format. Please double-check."
  User can: Correct number and resubmit, change carrier
  System: Validate format client-side first, only call API on format match

- Payout transfer fails (bank account closed, ACH return) →
  User sees: "We couldn't transfer your payout. Please update your bank details to retry."
  User can: Update bank account in settings, contact support
  System: Mark payout as held, do NOT auto-retry, send seller email with action required

### Business Rules
- Inbox sort: urgency-first (orders > 24h since placement bubble to top), then newest
- Payout SLA: payout released 7 days after `shipped-confirmed` if no buyer dispute filed
- Tracking validation: carrier-specific regex check client-side (UPS: `1Z[0-9A-Z]{16}`, USPS: `[0-9]{20,22}`, FedEx: `[0-9]{12,15}`)
- Notification threshold: orders unactioned > 48h trigger seller email reminder
- Buyer notes display: full text, no truncation, monospace font for readability
- Dispute window: 7 days from shipment confirmation, payout held until window closes
- Maximum payout per cycle: [DECISION NEEDED: Is there a per-payout cap for new sellers? Suggest: $5,000 cap for sellers under 30 days old]

### Happy Path
1. Seller opens inbox. Sees: list of orders sorted urgency-first, urgent orders flagged with red dot, count badge in nav. Can: click order, filter by status.
2. Seller clicks an order. Sees: order detail with buyer name, full shipping address, item list, buyer notes verbatim, "Mark Shipped" CTA. Can: copy address, mark shipped, contact buyer.
3. Seller clicks "Mark Shipped." Sees: modal with carrier dropdown and tracking number input. Can: enter tracking, select carrier, confirm.
4. Seller submits tracking. Sees: order status updates to "Shipped" with tracking number displayed and copy-to-clipboard button. Can: navigate to next order.
5. Seven days later (post-dispute-window). Sees: payout in dashboard marked "Pending release." Can: view expected release date.
6. Payout released. Sees: payout status "Paid" with bank reference and date. Can: download statement.

### Persona Constraints
- Persona: Seller — needs to plan fulfillment around real-world capacity constraints [ux-research.md]
  Constraint: inbox must surface urgent orders (placed > 24h ago) above newer orders — sellers reported missing aging orders in chronological-only views [ux-research.md]
  Constraint: buyer notes must render verbatim with no character limit and no truncation — fulfillment errors in v0 traced directly to truncated notes [ux-research.md, feature-intel.md]
  Constraint: payout SLA must be displayed prominently before the seller marks shipped — sellers in interviews cited payout uncertainty as the #1 reason for leaving competing platforms [feature-intel.md]
- Persona: Buyer (primary) — wants reassurance that the seller has acted [ux-research.md]
  Constraint: buyer must receive shipped notification within 5 minutes of seller's `marking-shipped → shipped-confirmed` transition — buyers reported anxiety when status updates lagged [ux-research.md]

### Empty/Loading/Error States
- Empty inbox: "No orders yet. Your first order will appear here within seconds of placement." CTA: "View your listings" linking to seller profile.
- Loading inbox: Skeleton rows matching final layout, no spinner.
- Loading order detail: Skeleton sections for address, items, notes — preserve header with order ID.
- Error inbox load: "We couldn't load your orders. Please refresh." with refresh button. Last-known-good cached data shown below with "Last updated 3 minutes ago" stale indicator.
- Error mark shipped: Inline error below tracking input, modal stays open, input preserved.

### Acceptance Criteria
- [ ] Verify that the seller inbox loads within 2 seconds and surfaces urgent orders (>24h old) at the top
- [ ] Verify that buyer notes render verbatim in order detail with no truncation regardless of length
- [ ] Verify that tracking number format is validated client-side per carrier before the API call
- [ ] Verify that the buyer receives a shipped notification within 5 minutes of the seller marking shipped
- [ ] Verify that payouts are held for 7 days after shipment and released only if no dispute is filed
- [ ] Verify that a failed payout transfer marks the payout as held and does NOT auto-retry
