# Page: Cart Review

## Screen Overview

Cart Review — first screen of the 3-screen Checkout flow. Buyer reviews carted items, adjusts quantities, applies discount codes, and proceeds to shipping. Seller persona can access this screen in read-only preview mode via fulfillment tools to spot-check pricing.

## Route

`/cart`

## ASCII Wireframe

### Desktop (1024px+)

```
┌──────────────────────────────────────────────────────────┐
│ [Header]                                                 │
│  STOCKYARD              [Search]  [Cart (3)]  [Account]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Your cart                                               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ [Cart Items List]                                │    │
│  │ ┌────────────────────────────────────────────┐   │    │
│  │ │ SKU-4420  Bearing, 6205-2RS   ×2   $14.80  │   │    │
│  │ │ [−] [+]                        [Remove]    │   │    │
│  │ ├────────────────────────────────────────────┤   │    │
│  │ │ SKU-7781  Hydraulic fitting    ×1   $42.00  │   │    │
│  │ │ [−] [+]                        [Remove]    │   │    │
│  │ ├────────────────────────────────────────────┤   │    │
│  │ │ SKU-0093  Hex bolt M8×40  [Sold out]       │   │    │
│  │ │           Removed from cart                │   │    │
│  │ └────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────┐  ┌───────────────────────────┐   │
│  │ [Discount Code]    │  │ [Order Summary]           │   │
│  │ ┌────────────────┐ │  │  Subtotal        $71.60   │   │
│  │ │ Promo code     │ │  │  Shipping         $5.99   │   │
│  │ └────────────────┘ │  │  Tax              —       │   │
│  │ [Apply]            │  │  ──────────────────────   │   │
│  └────────────────────┘  │  Total           $77.59   │   │
│                          └───────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ [CTA Bar]                                        │    │
│  │              [Continue to Shipping]               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ [Empty State]  (shown when cart empty)            │    │
│  │  Your cart is empty.                              │    │
│  │  Browse our makers to find something handmade.    │    │
│  │              [Browse Catalog]                     │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Content Hierarchy

| # | Section | Data Shown | Component | Data Source | Weight |
|---|---------|-----------|-----------|-------------|--------|
| 1 | Header | Logo, search, cart badge count, account link | `nav-top` from manifest | `local` (session + cart count) | tertiary |
| 2 | Cart Items List | Line items with SKU (mono), name, quantity controls, unit price, remove action, out-of-stock badge | `cart-row-compact` (custom — not in manifest) | `local` (localStorage cart) + `GET /api/inventory/check` | primary |
| 3 | Order Summary | Subtotal, shipping, tax, total — computed from cart items | `data-table` from manifest | `computed` (client-side from cart + `POST /api/tax/calculate`) | primary |
| 4 | Discount Code | Promo code text input + Apply button | `form-input` + `button-secondary` from manifest | `POST /api/discounts/validate` on apply | secondary |
| 5 | CTA Bar | "Continue to Shipping" full-width button | `button-primary` from manifest | `local` (navigates to `/checkout/shipping`) | primary |
| 6 | Empty State | Heading, body copy, Browse Catalog CTA | `custom` (empty-state layout) | `local` (static copy) | primary (when visible) |

**Note:** Row 2 uses slot `cart-row-compact` which does NOT exist in `component-manifest-marketplace.md`. This is intentional drift — exercises the orphan-slot warning per slice-3 schema §11.5.

## States

| State | Appearance |
|-------|-----------|
| empty-cart | Cart Items List and Order Summary hidden. Empty State section visible with heading, body copy, and Browse Catalog CTA. Discount Code hidden. CTA Bar hidden. |
| cart-review | Cart Items List rendered with all in-stock items. Order Summary shows subtotal, shipping, tax placeholder. CTA Bar enabled. Empty State hidden. |
| validating-inventory | Cart items dimmed to 60% opacity. "Checking availability..." text below cart list. CTA Bar disabled. Triggered on page mount before cart-review resolves. |
| error | Two sub-modes: (a) item out of stock — affected row shows `badge-stock` "Sold out" badge, item removed from total, inline notification shown; (b) network failure — banner at top: "Couldn't verify inventory. Please try again." with Retry button. |

## Key Copy

- **"Your cart"** — placement: page heading (h1). JetBrains Mono per Type=Mono-accented.
- **"Continue to Shipping"** — placement: primary button in CTA Bar (Buyer-facing, Copy=Punchy).
- **"Your cart is empty. Browse our makers to find something handmade."** — placement: empty-state heading + body (Buyer).
- **"'{item name}' is no longer available from {seller name}. We've removed it from your cart."** — placement: inline notification below affected cart row (Buyer).
- **"This is the buyer's cart preview. Use it to spot-check pricing before fulfillment."** — placement: top banner shown only when persona=Seller `(Seller-only banner)`.
- **"Promo code"** — placement: text input placeholder in Discount Code section (shared).
- **"Subtotal" / "Shipping" / "Tax" / "Total"** — placement: order summary row labels (shared). JetBrains Mono for dollar amounts per Type=Mono-accented.

## Responsive Behavior

| Breakpoint | Changes |
|-----------|---------|
| Desktop (1024px+) | Cart Items List full width. Order Summary and Discount Code side by side below items. CTA Bar full width at bottom. |
| Tablet (768px) | Order Summary and Discount Code stack vertically (Discount above Summary). Cart item rows unchanged. |
| Mobile (375px) | All sections stack vertically, full width with 16px margin. Quantity controls shrink to icon-only (−/+). Remove button becomes swipe-to-delete gesture. CTA Bar sticky at bottom of viewport. |

## Data Loading

- **On mount:** Read cart from `localStorage`. Immediately fire `GET /api/inventory/check` with cart item IDs to validate stock. Show `validating-inventory` state during check.
- **On inventory response:** Transition to `cart-review` (all in stock) or `error` (items removed). Recalculate subtotal.
- **On shipping change:** `POST /api/tax/calculate` with shipping address (if previously entered) to update tax line.
- **On discount apply:** `POST /api/discounts/validate` with promo code. On 200: apply discount to subtotal. On 404/422: inline error "Invalid promo code" below input.
- **Loading skeleton:** None for initial render (cart is local). Inventory check shows dimmed state, not skeleton.

## Component Picks

| Section | Role | Manifest Slot |
|---------|------|---------------|
| Header | Top navigation bar | `nav-top` |
| Cart Items List | Line item row with SKU, quantity, price | `cart-row-compact` *(not in manifest — intentional orphan slot)* |
| Cart Items List — Out-of-stock badge | Stock status indicator | `badge-stock` |
| Order Summary | Price breakdown table | `data-table` |
| Discount Code — Input | Promo code text field | `form-input` |
| Discount Code — Apply | Secondary action button | `button-secondary` |
| CTA Bar | Primary checkout action | `button-primary` |
| Empty State — Browse CTA | Secondary navigation button | `button-secondary` |
