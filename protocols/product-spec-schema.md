# product-spec.md Schema

## Purpose

Step 1.6's product-spec-writer emits `docs/plans/product-spec.md` with stable section anchors so that Phase 2 architects, Phase 2 planner, Phase 3 UX architect, Phase 4 Product Owner, and Phase 4 Briefing Officers can receive content-addressed refs instead of pasted content. This document defines the required structure, anchor convention, format rules, validation checklist, and product-type variations.

## Required Top-Level Sections

The product spec MUST contain these top-level headings, in this order:

- `# Product Spec`
- `## App Overview`
- `## Screen Inventory`
- `## Permissions & Roles`
- `## First 60 Seconds` *(audit fix #16 — required)*
- `## Cross-Feature Interactions`

Then, one `## Feature: {Name}` section per feature in the PRD scope.

### App Overview

Two parts, both required.

**Part 1 — Grounding paragraph.** One paragraph: what this app is and core value proposition. Not a restatement of the PRD — a grounding paragraph that any engineer can read in 10 seconds to understand the product.

**Part 2 — Persona Table.** A table listing every persona the product serves. One row flagged `(primary)` next to its name. Required columns: `Persona`, `Role`, `Primary JTBD`, `Relationship to Other Personas`.

Format:

```
| Persona | Role | Primary JTBD | Relationship to Other Personas |
|---------|------|--------------|--------------------------------|
| Buyer (primary) | End consumer placing orders | Find a trusted seller and complete a purchase fast | Buys from Seller; rates Seller post-transaction |
| Seller | Independent merchant fulfilling orders | Receive, fulfill, and get paid for orders without manual chasing | Sells to Buyer; notified by Buyer order events |
| Admin | Platform operator handling disputes | Resolve disputes between Buyer and Seller without losing trust on either side | Mediates Buyer ↔ Seller |
```

Rules:
- ≥ 1 row required. A single-persona product still uses the table — name the one persona explicitly.
- Exactly one row carries `(primary)` after the name.
- Persona names defined here are the canonical identifiers used in every per-feature `Persona Constraints` block. Do not introduce a persona name in a feature that does not appear in this table.
- Pull persona enumeration directly from `ux-research.md` (Persona Enumeration section). If `ux-research.md` lists N personas, this table has N rows.

Anchors: `product-spec.md#app-overview` (top-level grounding paragraph + table), `product-spec.md#app-overview/personas` (the table specifically, for refs.json indexing).

### Screen Inventory

Complete list of every screen in the app with a one-line description. Format:

```
| Screen | Description | Features |
|--------|-------------|----------|
| Login | Email/password + social auth | Auth |
| Dashboard | KPI cards, activity feed, charts | Dashboard, Notifications |
| Checkout (3 screens) | Cart review → Shipping → Confirmation | Checkout |
| Settings | Profile, notifications, billing, security tabs | Settings |
| Admin Panel | User management, analytics | Admin |
```

This is the master list. Per-feature sections reference screens from this inventory.

### Permissions & Roles

Define every role in the system and what each can access. Format:

```
| Role | Can Do | Cannot Do |
|------|--------|-----------|
| Anonymous | View public pages, sign up | Access dashboard, place orders |
| User | CRUD own resources, checkout | Manage other users, view admin |
| Admin | All user actions + manage users, view analytics | Delete system config |
```

If the product has no roles beyond "authenticated user," say so explicitly: "Single role: authenticated user. No admin or public access."

### First 60 Seconds

*(Audit fix #16 — required section. Closes the gap where no agent at any phase was forced to articulate what a first-time user gains from this product that they could not from the closest alternative. Intentionally minimal — one field per persona — to force a single sharp answer rather than form-filling. The structural force comes from the comparison-marker requirement, which makes this section a downstream constraint on `competitive-differentiation.md` rather than free-floating.)*

One subsection per persona in the persona table. Persona names must match the App Overview persona table exactly (including the `(primary)` flag where present).

Format:

```markdown
### Persona: {Name}

**First-encounter promise**: <one sentence — what does this persona learn, feel, or become capable of in their first encounter that they could not from {closest_alternative} from `competitive-differentiation.md`? Cite the alternative explicitly. The sentence MUST contain at least one comparison marker: "vs", "than", "compared to", "instead of", "rather than", or "unlike".>
```

That's it. One field. The comparison marker is the structural enforcement: a writer cannot satisfy the rule with "Maya browses cafes" — the parser will reject. They have to write something like "Maya finds an outlet at a glance, faster than Yelp's amenity-checklist UI."

Validation rules (mechanical — enforced at Slice 1 graph index):

1. Section `## First 60 Seconds` exists.
2. One `### Persona: {Name}` subsection per row in the App Overview persona table; persona names match exactly.
3. Each persona subsection contains the `**First-encounter promise**:` field.
4. The field has at least 50 chars of content (stub-prevention floor — higher than other floors because there's only one field carrying the section's weight).
5. The field contains at least one comparison marker: `vs`, `than`, `compared to`, `instead of`, `rather than`, or `unlike` (case-insensitive). This forces the writer to reference an external alternative — typically one named in `competitive-differentiation.md`. A field with no comparison is a stub by definition.

Failure on any rule = parser exit non-zero, BLOCK at Step 1.6.idx with the specific rule + persona that failed; product-spec-writer re-dispatches to fill the gap.

### Cross-Feature Interactions

A dependency map showing how features connect. Where an interaction crosses a persona boundary (one persona's action triggers another persona's experience), call this out explicitly with `(Persona) → (Persona)` notation. This is critical for marketplaces and other multi-sided products — without it, the seller-side and buyer-side experiences diverge silently.

Format:

```
- Auth → Checkout: user must be authenticated to check out
- Order Placement (Buyer) → Order Notification (Seller): seller notified within 60s when buyer submits order
- Order Fulfillment (Seller) → Order Status (Buyer): buyer sees status update when seller marks shipped
- Dispute (Buyer or Seller) → Mediation (Admin): admin queue receives dispute when either party files
- Checkout → Inventory: stock check at cart review and at submit
- Dashboard → Settings: display preferences read from user settings
- Notifications → Auth, Checkout, Dashboard: triggered by events in each
```

Every dependency must be bidirectional — if A depends on B, B's feature section must mention A under its own interactions. Persona-crossing interactions must appear in BOTH personas' feature sections.

## Required Per-Feature Sections

Every `## Feature: {Name}` section MUST contain these subsections, in this order:

### States
Flat list of all states this feature can be in. Minimum 3: a loaded state, an empty/initial state, and an error state. Include meta-states as relevant: loading, stale, offline, permission-denied, disabled. The first entry is the initial state.

Format: `States: initial (initial), loading, loaded, empty, error, stale`

### Transitions
Table of valid state changes.

Format:
```
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| initial → loading | Page mount | User authenticated | Fetch GET /api/orders |
| loading → loaded | API 200 | Response has ≥1 item | Render list |
| loading → empty | API 200 | Response has 0 items | Show empty state |
| loading → error | API 4xx/5xx or timeout | — | Show error message |
```

### Data Requirements
Per-state data needs. What data is displayed, where it comes from, what shape it has.

Format:
```
- loaded: list of orders [{id, status, total, created_at, items[]}] from GET /api/orders
- empty: no data needed, static copy
- error: error message string from API response or "Something went wrong. Please try again."
```

### Failure Modes
Per-transition failures. What can go wrong, what the user sees (exact copy), what they can do, what the system does.

Format:
```
- Network failure during checkout submit →
  User sees: "We couldn't process your order. Please check your connection and try again."
  User can: Retry (button), go back to cart
  System: Log error, do NOT create partial order
```

### Business Rules
Bullet list with concrete values. Every rule has a number or a `[DECISION NEEDED]` flag.

### Happy Path
Numbered steps. Each step: what the user sees, what they can do, what happens.

### Persona Constraints
Which personas this feature serves and what research findings shaped its design for each. Every constraint MUST attribute to a specific persona named in the App Overview persona table. Cite specific findings from `ux-research.md` and `feature-intel.md`.

Rules:
- One constraint block per persona that uses this feature.
- Persona names must match the App Overview table verbatim (including `(primary)` flag where applicable).
- If a feature serves multiple personas, list a constraint block per persona — even if some constraints overlap, attribute each to the persona it shapes the design for.
- If a feature serves only one persona, name it explicitly. Do not leave persona attribution implicit.

Format (multi-persona example — marketplace order placement):
```
- Persona: Buyer (primary) — time-poor, scans, doesn't read [ux-research.md]
  Constraint: keep checkout to 3 steps max — competitors average 5+ [feature-intel.md]
  Constraint: show progress indicator at top of each step — persona abandons flows without visible progress [ux-research.md]
- Persona: Seller — needs visibility into pending orders to plan fulfillment [ux-research.md]
  Constraint: notification within 60s of order placed — sellers report losing time-sensitive orders to slower competitors [ux-research.md]
  Constraint: order detail must include buyer-supplied notes verbatim — fulfillment errors traced to truncated notes in v0 [ux-research.md]
```

### Empty/Loading/Error States
What the user sees in each non-happy state. Include specific copy and call-to-action for empty states.

### Acceptance Criteria
Testable statements using checkbox format. Each starts with "Verify that..."

Format:
```
- [ ] Verify that checkout completes in 3 steps or fewer
- [ ] Verify that discount code validates without page reload
- [ ] Verify that out-of-stock items show inline notification, not a generic error page
```

## Optional Per-Feature Sections

Include based on product type. Omit if not applicable — do not stub empty sections.

- **Notification Triggers** — channel (email/push/in-app), timing (immediate/delayed/batched), content summary, opt-out mechanism. Required for: SaaS with user accounts, marketplaces, mobile apps.
- **Technical Constraints & Integrations** — third-party services this feature depends on (payment processor, geocoding API, email provider, analytics), rate limits, SDK requirements, authentication method for each. Required for: features that call external APIs or use third-party SDKs.
- **Copy Direction** — tone examples for CTAs, errors, empty states, confirmations specific to this feature. Required for: consumer-facing products, marketplaces.
- **Offline Behavior** — what's cached, what degrades, what's blocked. Required for: mobile apps, PWAs.
- **Multi-User Scenarios** — concurrent access, conflict resolution, real-time sync. Required for: collaborative tools, marketplaces, multi-tenant SaaS.
- **Performance Expectations** — latency targets per interaction. Required for: search-heavy products, real-time dashboards, e-commerce checkout.
- **Inter-Screen Data Flow** — what state carries from this feature's screens to other screens (URL params, local storage, context providers, server session). What data this feature reads that another feature writes, and vice versa. Required for: multi-screen flows, features that share state.

## Anchor Naming Convention

Anchors follow `product-spec.md#{feature}/{section}` format for refs.json indexing.

Rules:
- Feature names are kebab-case: `checkout`, `user-dashboard`, `admin-settings`
- Section names are kebab-case: `states`, `transitions`, `data-requirements`, `failure-modes`, `business-rules`, `happy-path`, `persona-constraints`, `empty-states`, `acceptance-criteria`
- Full anchor example: `product-spec.md#checkout/business-rules`
- Top-level sections use flat anchors: `product-spec.md#app-overview`, `product-spec.md#screen-inventory`, `product-spec.md#permissions`, `product-spec.md#cross-feature`
- Anchors must be stable across regeneration — same inputs produce same anchors

The Refs Indexer (Phase 2.2) parses these anchors into `refs.json` alongside architecture and PRD anchors.

## Product-Type Variations

| Section | Web SaaS | Dashboard/Analytics | API/Dev Tool | iOS/Mobile | CLI | Marketplace |
|---------|----------|-------------------|-------------|-----------|-----|-------------|
| States | Required | Required | Omit (use request lifecycle) | Required + app lifecycle | Omit (use exit codes) | Required × 2 roles |
| Transitions | Required | Required (lighter) | Required (request/response) | Required + background states | Required (command flow) | Required × 2 roles |
| Data Requirements | Required | Required (heavy) | Required (request/response shapes) | Required + cache strategy | Required (stdin/stdout) | Required × 2 roles |
| Failure Modes | Required | Required | Required (error codes) | Required + offline failures | Required (exit codes) | Required × 2 roles |
| Happy Path | Required | Required | Required (request examples) | Required | Required (command examples) | Required × 2 roles |
| Business Rules | Required | Light | Required (rate limits, quotas) | Required | Light | Required (both sides) |
| Empty States | Required | Required | N/A | Required | N/A | Required × 2 roles |
| Notification Triggers | Optional | Optional | N/A | Required | N/A | Required |
| Offline Behavior | Optional | N/A | N/A | Required | N/A | Optional |
| Multi-User Scenarios | Optional | Optional | Optional | Optional | N/A | Required |
| Performance | Optional | Required | Required | Optional | Optional | Optional |

## Validation Checklist

Step 1.7 runs these checks. Failure sends the spec back to the product-spec-writer with specific gaps.

**Mechanical checks (no LLM, ~0 tokens):**
1. Every feature in `design-doc.md` scope has a `## Feature: {Name}` section
2. Every feature section has all 9 required subsections (States through Acceptance Criteria, including Persona Constraints)
3. Every States list has ≥ 3 entries
4. Every Transitions table has ≥ 1 row
5. No banned vague phrases: "appropriate," "as needed," "standard," "graceful," "configurable," "reasonable," "properly," "adequate"
6. All `[DECISION NEEDED]` tags are well-formed: `[DECISION NEEDED: question | Suggest: value]` or `[DECISION NEEDED: question]`
7. Permissions & Roles section exists and is non-empty
8. Cross-Feature Interactions section exists and is non-empty
9. Screen Inventory section exists and is non-empty
10. Every acceptance criterion starts with "Verify that"
11. App Overview persona table has ≥ 1 row, each persona has a role and JTBD, exactly one persona is flagged `(primary)`, and the `Relationship to Other Personas` column is filled for each row
12. Every feature's Persona Constraints attributes each constraint to a named persona that appears in the App Overview persona table (no orphan persona names, no implicit attribution)
13. For multi-persona products: every Cross-Feature Interactions entry that crosses a persona boundary uses the `(Persona) → (Persona)` annotation

**State machine checks (mechanical, ~0 tokens):**
14. Every state in a States list appears in at least one Transitions row (no orphan states)
15. Every Transitions row references states that exist in the States list
16. No transition has empty preconditions (every transition requires something to be true, even if it's just "user clicks button")
17. Error states have at least one outgoing transition (recovery path) OR are marked terminal
18. The initial state is explicitly identified in the States list (first entry or marked with "(initial)")

## Worked Example: Marketplace Order Placement (Buyer + Seller)

This example illustrates the multi-persona pattern. App Overview persona table for this hypothetical product would include at minimum `Buyer (primary)` and `Seller`. The feature below is order placement, which originates with the Buyer but has direct downstream effects on the Seller (notification, fulfillment queue) — so its `Persona Constraints` block has entries for both personas, and the top-level `Cross-Feature Interactions` map records the persona-crossing edge.

```markdown
## Feature: Checkout

### States
States: empty-cart (initial), cart-review, entering-shipping, confirming, processing, completed, failed

### Transitions
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| empty-cart → cart-review | Add first item | User authenticated | Cart created in local storage |
| cart-review → entering-shipping | Click "Continue to Shipping" | Cart has ≥ 1 in-stock item | Validate inventory via GET /api/inventory/check |
| cart-review → empty-cart | Remove last item | — | Clear cart from local storage |
| entering-shipping → confirming | Submit shipping form | All required fields valid, address verified | Calculate tax via POST /api/tax/calculate |
| confirming → processing | Click "Place Order" | — | POST /api/orders, disable button, show spinner |
| processing → completed | API 201 | Order created | Show confirmation, send email, clear cart |
| processing → failed | API 4xx/5xx or 30s timeout | — | Show error message, re-enable "Place Order" |
| failed → processing | Click "Try Again" | Poll GET /api/orders/{id} confirms no order exists | Retry POST /api/orders |
| failed → cart-review | Click "Review Cart" | — | Navigate back, cart preserved |
| any → cart-review | Click browser back / breadcrumb | — | State preserved, no data loss |

### Data Requirements
- cart-review: cart items [{id, name, price, quantity, image_url}] from local storage, inventory status from GET /api/inventory/check
- entering-shipping: saved addresses from GET /api/user/addresses (if any), country list static
- confirming: order summary {items, subtotal, shipping, tax, discount, total} computed client-side, tax from API
- processing: no new data, spinner only
- completed: order {id, estimated_delivery, email} from POST /api/orders response
- failed: error message from API response body
- empty-cart: no data, static copy

### Failure Modes
- Inventory check fails (item out of stock after carting) →
  User sees: "'{item name}' is no longer available. We've updated your cart."
  User can: Continue with remaining items, or go back to browse
  System: Remove item from cart, recalculate total

- Shipping address validation fails →
  User sees: Inline field errors ("Enter a valid ZIP code")
  User can: Correct fields and resubmit
  System: No API call until client-side validation passes

- Payment processing fails →
  User sees: "We couldn't process your payment. Please check your card details and try again."
  User can: Retry, change payment method, go back to cart
  System: Log failure reason, do NOT create partial order, do NOT charge card

- Network failure during order submit →
  User sees: "Connection lost. Your cart is saved — try again when you're back online."
  User can: Retry when connection restores
  System: Cart persisted in local storage, no server-side state created

- 30s timeout during processing →
  User sees: "This is taking longer than expected. Please wait or try again."
  User can: Wait (spinner continues) or click "Try Again"
  System: If order was created server-side, poll GET /api/orders/{id} to confirm before retrying

### Business Rules
- Discount codes: one per order, validated in real-time via POST /api/discounts/validate, shows adjusted total immediately
- Tax: calculated by jurisdiction based on shipping address, displayed at confirmation step
- Inventory: checked at cart-review entry AND at order submit — stale cart items removed with notification
- Minimum order: [DECISION NEEDED: Is there a minimum order value? Suggest: no minimum]
- Shipping: [DECISION NEEDED: Free shipping threshold? Suggest: free over $50, flat $5.99 under]
- Order timeout: 30 seconds before showing timeout message
- Cart persistence: local storage, survives browser close, expires after 7 days
- Pricing display: [DECISION NEEDED: Include tax in displayed prices or show separately? Common options: tax-exclusive (US standard) or tax-inclusive (EU standard)]

### Happy Path
1. User is on cart-review screen. Sees: item list with names, prices, quantities, images. Subtotal displayed. Can: edit quantities (inline +/- buttons), remove items, apply discount code, click "Continue to Shipping."
2. User clicks "Continue to Shipping." Sees: shipping form with saved addresses (if any) or empty form. Required fields: name, street, city, state, ZIP, country. Can: select saved address or enter new one.
3. User submits shipping. Sees: order confirmation screen with full summary — items, subtotal, shipping cost, tax, discount (if applied), total. Can: edit any section (back navigation preserves all data), click "Place Order."
4. User clicks "Place Order." Sees: button disabled, spinner. Waits up to 10 seconds.
5. Order succeeds. Sees: confirmation page with order ID, estimated delivery date, "A confirmation email has been sent to {email}." Can: click "Continue Shopping" or view order in account.

### Persona Constraints
- Persona: Buyer (primary) — time-poor, scans, doesn't read [ux-research.md]
  Constraint: checkout must complete in 3 steps — competitors average 5+ steps; research shows each additional step loses ~10% of users [feature-intel.md]
  Constraint: show progress indicator at top of each step — persona abandons flows without visible progress [ux-research.md]
  Constraint: real-time discount validation — competitors require page reload, this is a key differentiator [feature-intel.md]
- Persona: Seller — needs immediate visibility into incoming orders to plan fulfillment [ux-research.md]
  Constraint: order notification fires within 60s of buyer's `processing → completed` transition — sellers in interviews reported losing time-sensitive orders to faster-notifying competitors [ux-research.md]
  Constraint: order payload to seller includes buyer-supplied notes verbatim (no truncation) — fulfillment errors traced to truncated notes in v0 research [ux-research.md]

### Empty/Loading/Error States
- Empty cart: "Your cart is empty. Browse our products to find something you'll love." CTA: "Start Shopping" button linking to product catalog.
- Loading (inventory check): Skeleton cards matching item layout, no spinner.
- Loading (tax calculation): Subtotal visible, tax line shows "Calculating..." with shimmer.
- Loading (order processing): "Place Order" button disabled, inline spinner, "Processing your order..." text.
- Error (generic): "Something went wrong. Please try again." with "Retry" button. Never a full-page error — always inline within the checkout flow.

### Performance Expectations
- Cart page load: < 1s TTI (Time to Interactive) on 4G connection
- Discount code validation: < 500ms API response, show inline spinner during request
- Tax calculation: < 1s API response, show shimmer placeholder during calculation
- Order submission: < 10s to confirmation, show spinner, timeout message at 30s

### Notification Triggers
- Order placed → Email (immediate): order confirmation with item summary, order ID, estimated delivery, tracking link
- Payment failed → Email (immediate): retry prompt with direct link to payment page, cart preserved
- Cart abandoned (7 days) → Email (delayed, 24h after last activity): reminder with cart contents and direct link to resume

### Acceptance Criteria
- [ ] Verify that checkout completes in 3 steps (cart review, shipping, confirmation)
- [ ] Verify that user can navigate back to any previous step without losing entered data
- [ ] Verify that discount code validates in real-time without page reload
- [ ] Verify that out-of-stock items detected during checkout show inline notification with item name
- [ ] Verify that payment failure shows specific error message with retry option, not a generic error page
- [ ] Verify that cart persists across browser close and is recoverable
- [ ] Verify that order confirmation displays order ID and sends confirmation email
- [ ] Verify that the "Place Order" button is disabled during processing to prevent double-submit
- [ ] Verify that 30s timeout during processing shows timeout message with retry option
```
