# Overview

CraftMarket is a peer-to-peer marketplace where independent makers sell handmade goods directly to buyers. The platform handles payments, dispute resolution, and seller payouts. The buyer experience prioritizes fast discovery and trust signals; the seller experience prioritizes order visibility and reliable payouts.

The system serves two primary personas: Buyers who browse and purchase handmade goods, and Sellers who fulfill orders and receive payouts. Auth is handled via Supabase Auth with JWT-based sessions. The frontend is a Next.js 15 app deployed on Vercel; the backend uses tRPC over Postgres via Supabase.

Key features: Product Discovery, Order Placement, Seller Fulfillment, with supporting Auth and Inventory subsystems.

# Frontend

The frontend is a Next.js 15 App Router application using React Server Components where possible. Client components are used for interactive elements (cart, search filters, checkout forms). The design system follows a Brutalist aesthetic with hairline rules and dense layouts per the component manifest.

## Layout

The application uses a top-level layout with a sticky top navigation bar (hairline bottom rule, no backdrop-blur). Routing follows Next.js App Router conventions with nested layouts for seller-scoped pages under `/seller/*`.

Navigation map:
- `/` — Catalog (sidebar: none, nav: top bar with search)
- `/product/[id]` — Product Detail (nav: breadcrumb back to Catalog)
- `/cart` — Cart Review (nav: top bar, breadcrumb)
- `/checkout/shipping` — Shipping Entry (nav: progress indicator, breadcrumb)
- `/checkout/confirm` — Order Confirmation (nav: progress indicator)
- `/seller/inbox` — Seller Order Inbox (nav: seller sidebar + top bar)
- `/seller/orders/[id]` — Order Fulfillment Detail (nav: seller sidebar, breadcrumb)
- `/seller/payouts` — Payout Dashboard (nav: seller sidebar)
- `/account` — Account Settings (nav: top bar)

Public, unauthenticated, content-indexable surface: yes — Catalog and Product Detail pages are publicly accessible and server-rendered for SEO.

## Components

Core components and responsibilities:
- `ProductCard` — displays product thumbnail, title, price, seller name, rating badge, stock status
- `SearchFilters` — sidebar filter panel with category, price range, color chips; AND across types, OR within type
- `CartItem` — editable line item row with quantity +/- controls, remove button, subtotal
- `CheckoutProgress` — 3-step progress indicator (Cart → Shipping → Confirm)
- `OrderRow` — seller inbox row showing buyer name, item summary, total, urgency flag, placed-at timestamp
- `PayoutRow` — payout line with order reference, amount, status badge (pending/released), eligible date
- `MonoPriceDisplay` — monospace-accented price formatting component (custom, no library equivalent)

## State

State management approach:
- Server state: React Server Components fetch data at the route level; no client-side cache for server-rendered pages
- Client state: React `useState` / `useReducer` for form state (checkout, account settings)
- Cart state: persisted to `localStorage` with a 7-day TTL, hydrated on mount via a `useCart` hook
- Search/filter state: URL search params as source of truth, synced via `useSearchParams`
- Auth state: Supabase Auth client session, accessed via `useSession` hook wrapping `@supabase/auth-helpers-nextjs`

## Styling

Design tokens follow the Brutalist component manifest:
- Colors: cream background (`#FAF9F6`), charcoal text (`#2D2D2D`), accent red (`#C0392B`) for urgency flags
- Typography: Inter for body, JetBrains Mono for prices and SKU labels
- Spacing: 8px base unit, 32px row height for dense tables
- Borders: 1px hairline rules, no box shadows, sharp corners (no border-radius)
- CSS approach: Tailwind CSS with a custom theme extending the design tokens above

# Backend

The backend is a tRPC API layer running inside Next.js API routes. Supabase provides Postgres hosting, auth, and row-level security. All mutations go through tRPC procedures with Zod input validation.

## Services

Service boundaries:
- **Auth Service** — sign-up, sign-in, session refresh, password reset via Supabase Auth
- **Product Service** — CRUD for product listings, search with full-text Postgres `tsvector`, inventory checks
- **Order Service** — cart operations, order placement with idempotency, order status transitions
- **Fulfillment Service** — seller order inbox, mark-shipped flow, tracking validation
- **Payout Service** — payout eligibility calculation, payout release after dispute window

## API Contracts

**POST /api/auth/signin**
- Request: `{ email: string, password: string }`
- Response: `{ user: { id: string, email: string, role: "buyer" | "seller" }, session: { access_token: string, expires_at: number } }`
- Auth required: no
- Error codes: 400 (invalid credentials format), 401 (wrong email or password), 429 (rate limited)

**GET /api/products**
- Request: query params `?q=string&category=string&color=string&min_price=number&max_price=number&sort=relevance|newest&cursor=string&limit=number`
- Response: `{ products: [{ id: string, title: string, price: number, image_url: string, seller_id: string, seller_name: string, rating: number, in_stock: boolean }], next_cursor: string | null, total: number }`
- Auth required: no
- Error codes: 400 (invalid filter params), 500 (search index unavailable)

**GET /api/products/suggestions**
- Request: query params `?q=string`
- Response: `{ suggestions: [{ query: string, result_count: number }] }`
- Auth required: no
- Error codes: 400 (empty query), 500 (search index unavailable)

**POST /api/cart** (provides: order-placement)
- Request: `{ product_id: string, quantity: number }`
- Response: `{ cart: { id: string, items: [{ product_id: string, title: string, price: number, quantity: number, image_url: string }], subtotal: number } }`
- Auth required: yes
- Error codes: 400 (invalid product_id or quantity), 401 (unauthenticated), 404 (product not found), 409 (insufficient stock)

**GET /api/inventory/{id}** (provides: inventory) (consumes: order-placement)
- Request: path param `id` (product ID)
- Response: `{ product_id: string, available: number, reserved: number, warehouse: string }`
- Auth required: no
- Error codes: 404 (product not found), 500 (inventory service unavailable)

**POST /api/orders** (provides: order-placement)
- Request: `{ items: [{ id: string, qty: number }], shipping_address: { street: string, city: string, state: string, zip: string, country: string }, idempotency_key: string }`
- Response: `{ order_id: string, total: number, status: "pending", estimated_delivery: string }`
- Auth required: yes
- Error codes: 400 (invalid items), 401 (unauthenticated), 409 (out of stock), 422 (invalid shipping address)

**GET /api/orders**
- Request: query params `?status=string&cursor=string&limit=number`
- Response: `{ orders: [{ id: string, total: number, status: string, placed_at: string, items_summary: string }], next_cursor: string | null }`
- Auth required: yes
- Error codes: 401 (unauthenticated), 500 (database unavailable)

**POST /api/seller/orders/{id}/ship** (provides: seller-fulfillment)
- Request: `{ tracking_number: string, carrier: "ups" | "usps" | "fedex" }`
- Response: `{ order_id: string, status: "shipped", tracking_number: string, shipped_at: string }`
- Auth required: yes (seller role)
- Error codes: 400 (invalid tracking format), 401 (unauthenticated), 403 (not order's seller), 404 (order not found), 409 (order already shipped)

**GET /api/seller/payouts**
- Request: query params `?status=pending|released&cursor=string&limit=number`
- Response: `{ payouts: [{ order_id: string, amount: number, status: "pending" | "released", eligible_at: string, paid_at: string | null }], next_cursor: string | null }`
- Auth required: yes (seller role)
- Error codes: 401 (unauthenticated), 403 (not a seller)

## Persistence

Data layer uses Supabase-hosted Postgres with the Supabase JS client for queries. Migrations managed via Supabase CLI (`supabase db push`). Row-level security (RLS) policies enforce tenant isolation — buyers see only their own orders, sellers see only orders assigned to them.

ORM: none — raw SQL via Supabase client `rpc()` for complex queries, `.from().select()` for simple reads. This avoids ORM overhead and keeps queries transparent for RLS debugging.

Connection pooling: Supabase PgBouncer in transaction mode, 20 connections per serverless function instance.

# Data Model

## Entities

**User**
- Fields: id: uuid, email: string, display_name: string, role: enum('buyer','seller','admin'), avatar_url: string, created_at: timestamp, updated_at: timestamp
- Indexes: idx_users_email (unique), idx_users_role

**Product**
- Fields: id: uuid, seller_id: uuid (FK → User), title: string, description: text, price: number, image_urls: text[], category: string, color: string, search_vector: tsvector, in_stock: boolean, created_at: timestamp, updated_at: timestamp
- Indexes: idx_products_seller_id, idx_products_category, idx_products_search_vector (GIN), idx_products_created_at

**Order**
- Fields: id: uuid, buyer_id: uuid (FK → User), seller_id: uuid (FK → User), total: number, status: enum('pending','processing','shipped','delivered','disputed','cancelled'), shipping_address: jsonb, idempotency_key: string, placed_at: timestamp, shipped_at: timestamp, delivered_at: timestamp
- Indexes: idx_orders_buyer_id, idx_orders_seller_id, idx_orders_status, idx_orders_placed_at, idx_orders_idempotency_key (unique)

**OrderItem**
- Fields: id: uuid, order_id: uuid (FK → Order), product_id: uuid (FK → Product), quantity: number, unit_price: number, line_total: number
- Indexes: idx_order_items_order_id, idx_order_items_product_id

**Inventory**
- Fields: id: uuid, product_id: uuid (FK → Product), available: number, reserved: number, warehouse: string, updated_at: timestamp
- Indexes: idx_inventory_product_id (unique), idx_inventory_warehouse

**Payout**
- Fields: id: uuid, seller_id: uuid (FK → User), order_id: uuid (FK → Order), amount: number, status: enum('pending','released','held','failed'), eligible_at: timestamp, paid_at: timestamp, bank_reference: string
- Indexes: idx_payouts_seller_id, idx_payouts_status, idx_payouts_eligible_at

## Migrations

Migration strategy: Supabase CLI migrations (`supabase migration new`, `supabase db push`). Each migration is a single SQL file in `supabase/migrations/`. Migrations run in order on deploy. Rollback is manual — write a reverse migration.

Seed data: development seed script populates 50 products across 5 sellers, 10 buyers, and 20 sample orders for local testing.

# Security

## Auth

Authentication via Supabase Auth with email/password sign-up. Sessions use JWT stored in httpOnly cookies (not localStorage) to prevent XSS token theft. Access tokens expire after 1 hour; refresh tokens rotate on use with a 7-day absolute expiry.

Authorization model:
- Row-level security (RLS) on all tables — policies enforce that buyers see only their own orders, sellers see only orders assigned to them
- Role-based access: `buyer`, `seller`, `admin` roles stored in `User.role`, checked in RLS policies and tRPC middleware
- Admin override: admins bypass RLS via a service-role key used only in admin API routes

## Input Validation

All tRPC procedures use Zod schemas for input validation. Validation runs server-side before any database query. Client-side validation mirrors server schemas for UX but is never trusted.

Specific rules:
- Email: RFC 5322 format via Zod `.email()`
- Shipping address: all fields required, ZIP validated per country format
- Tracking numbers: carrier-specific regex (UPS: `1Z[0-9A-Z]{16}`, USPS: `[0-9]{20,22}`, FedEx: `[0-9]{12,15}`)
- Quantity: positive integer, max 99 per item
- Idempotency key: UUID v4 format, required on all mutation endpoints

## Secrets

Secret storage: Vercel environment variables for production, `.env.local` for development. Secrets never committed to git.

Required secrets:
- `SUPABASE_URL` — Supabase project URL — config — required
- `SUPABASE_ANON_KEY` — Supabase anonymous key for client-side auth — config — required
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key for admin operations — secret — required
- `NEXT_PUBLIC_SITE_URL` — public site URL for OAuth redirects — config — required

Rotation: Supabase keys rotated quarterly via Supabase dashboard. Vercel env vars updated manually; no automated rotation pipeline for v1.

# Infrastructure

## Deployment

Deployment target: Vercel (automatic deploys from `main` branch).
- Preview deployments on every PR for visual QA
- Production deploy on merge to `main`
- Environment strategy: `development` (local), `preview` (Vercel PR deploys), `production` (Vercel production)
- CI/CD: GitHub Actions for lint + type-check + test on PR; Vercel handles build + deploy

## Caching

- CDN: Vercel Edge Network caches static assets and ISR pages
- API responses: `GET /api/products` responses cached at the edge for 60 seconds via `Cache-Control: s-maxage=60, stale-while-revalidate=300`
- Client-side: product search results cached in memory for 60 seconds keyed on query+filters
- Database: no explicit query cache — Supabase PgBouncer handles connection reuse; Postgres shared buffers handle hot data

## Background Jobs

- Order notification: Supabase Edge Function triggered by database webhook on `orders` INSERT — sends email to seller within 60 seconds
- Payout release: Supabase scheduled function (cron) runs daily at 00:00 UTC, releases eligible payouts where `eligible_at <= now()` and no dispute filed
- Inventory sync: no background job for v1 — inventory updated synchronously on order placement and cancellation

## Env Vars

- `SUPABASE_URL` — Supabase project URL — config — required
- `SUPABASE_ANON_KEY` — Supabase anonymous key — config — required
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key — secret — required
- `NEXT_PUBLIC_SITE_URL` — public site URL — config — required
- `VERCEL_ENV` — Vercel environment identifier — config — auto-set by Vercel
- `SMTP_HOST` — email service host for transactional emails — config — required in production
- `SMTP_API_KEY` — email service API key — secret — required in production

# Scope

In scope for v1:
- Product Discovery: search, filters, infinite scroll, product detail with image carousel
- Order Placement: cart, 3-step checkout (cart review → shipping → confirmation), idempotent order creation
- Seller Fulfillment: order inbox with urgency sorting, mark-shipped with tracking validation, payout dashboard
- Auth: email/password sign-up and sign-in via Supabase Auth, role-based access (buyer/seller/admin)
- Inventory: real-time stock checks at cart entry and order submit

# Out of Scope

Deferred to v2 or later:
- Shipping carrier API integration (v1 uses manual tracking entry)
- Dispute resolution workflow (v1: admin handles disputes manually via Supabase dashboard)
- Seller onboarding flow (v1: sellers created manually by admin)
- Multi-currency support (v1: USD only)
- Review and rating system (v1: no buyer reviews)
- Push notifications (v1: email only)
- Analytics dashboard (v1: Vercel Analytics for basic metrics)
- Receipt OCR or image processing
- Social login (Google, Apple) — v1 uses email/password only
