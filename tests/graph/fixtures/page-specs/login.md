# Page: Login

## Screen Overview

Login screen — unauthenticated entry point for Buyer and Seller personas. Sub-screen of Account Settings; serves as the gate before any transactional action on Stockyard.

## Route

`/login`

## ASCII Wireframe

### Desktop (1024px+)

```
┌──────────────────────────────────────────────────────────┐
│ [Header]                                                 │
│  STOCKYARD                                    [Sign Up]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              ┌──────────────────────────┐                │
│              │ [Login Form]             │                │
│              │                          │                │
│              │  Sign in to Stockyard    │                │
│              │                          │                │
│              │  Email                   │                │
│              │  ┌──────────────────────┐│                │
│              │  │                      ││                │
│              │  └──────────────────────┘│                │
│              │  Password               │                │
│              │  ┌──────────────────────┐│                │
│              │  │                      ││                │
│              │  └──────────────────────┘│                │
│              │                          │                │
│              │  ┌──────────────────────┐│                │
│              │  │    [Sign in]         ││                │
│              │  └──────────────────────┘│                │
│              │                          │                │
│              │  [Forgot Password Link]  │                │
│              │  Forgot your password?   │                │
│              │                          │                │
│              ├──────────────────────────┤                │
│              │ [Sign Up Prompt]         │                │
│              │ No account? Sign up      │                │
│              └──────────────────────────┘                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Content Hierarchy

| # | Section | Data Shown | Component | Data Source | Weight |
|---|---------|-----------|-----------|-------------|--------|
| 1 | Header | Logo wordmark, Sign Up link | `nav-top` from manifest | `local` (static) | tertiary |
| 2 | Login Form | Email input, password input, Sign In button | `form-input` × 2 + `button-primary` from manifest | `local` (user input) → `POST /api/auth/login` on submit | primary |
| 3 | Forgot Password Link | "Forgot your password?" text link | `button-tertiary` from manifest | `local` (static link to `/forgot-password`) | tertiary |
| 4 | Sign Up Prompt | "No account? Sign up" with link | `custom` (inline text + link) | `local` (static link to `/signup`) | tertiary |

## States

| State | Appearance |
|-------|-----------|
| idle | Form rendered with empty fields, Sign In button enabled, no messages visible. |
| loading | Sign In button disabled with inline spinner replacing label text. Email and password fields locked. |
| error | Inline error below form: "Invalid email or password" in `colors.error` (#DC2626). Fields remain editable, Sign In re-enabled. |
| locked | Form fields hidden. Inline message replaces form body: "Too many attempts. Try again in 15 minutes." in `colors.error`. Sign In button removed. Forgot Password link remains visible. Triggered after 5 consecutive failed attempts. |

## Key Copy

- **"Sign in to Stockyard"** — placement: page heading (h1). JetBrains Mono per Type=Mono-accented.
- **"Sign in"** — placement: primary button label (Copy=Punchy, ≤3 words).
- **"Invalid email or password"** — placement: inline error below form, visible in `error` state.
- **"Too many attempts. Try again in 15 minutes."** — placement: inline error replacing form body, visible in `locked` state.

## Responsive Behavior

| Breakpoint | Changes |
|-----------|---------|
| Desktop (1024px+) | Form centered in viewport, max-width 400px. Header full-width with logo left, Sign Up link right. |
| Tablet (768px) | Same layout as desktop. Form max-width unchanged. |
| Mobile (375px) | Form stretches to full width with 16px horizontal margin. Header collapses Sign Up link into a text link below the form. |

## Data Loading

- **On mount:** No data fetched. Form renders immediately from static markup.
- **On submit:** `POST /api/auth/login` with `{ email, password }`. On 200: redirect to `/` (or return URL from query param). On 401: show error state. On 429: show locked state.
- **Loading skeleton:** None — form is static, no async data on initial render.

## Component Picks

| Section | Role | Manifest Slot |
|---------|------|---------------|
| Header | Top navigation bar | `nav-top` |
| Login Form — Email | Text input | `form-input` |
| Login Form — Password | Text input (masked) | `form-input` |
| Login Form — Sign In | Primary CTA button | `button-primary` |
| Forgot Password Link | Text link action | `button-tertiary` |
| Sign Up Prompt | Inline text with link | `custom` |
