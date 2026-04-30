# Overview

ExpenseFlow is a B2B expense reporting tool for small-to-mid teams. End-users submit expense reports with receipts, approvers review and approve or reject them, and admins configure spend policies and audit the activity log. The platform reduces approval cycle time from days to hours by routing reports to the right approver automatically and surfacing policy violations at submit-time.

The system serves three personas: End-Users who submit expense reports, Approvers (managers) who review them, and Admins who configure policies and audit activity. Auth is handled via Auth0 with OIDC. The frontend is a Remix app; the backend is Express on Node.js with MongoDB. Deployed on Render.

Key features: Expense Submission, Approval Workflow, Audit Log.

# Frontend

The frontend is a Remix application using nested routes and loaders for server-side data fetching. Client-side interactivity is handled via Remix actions and progressive enhancement. The design follows a clean corporate aesthetic with clear hierarchy and accessible form patterns.

## Layout

The application uses a sidebar layout for authenticated users. The sidebar contains navigation links scoped by role. Top bar shows user name, role badge, and notification bell.

Navigation map:
- `/submit` — Submit Expense (sidebar: "New Report", nav: sidebar + top bar)
- `/my-reports` — My Reports (sidebar: "My Reports", nav: sidebar + top bar)
- `/approvals` — Approval Queue (sidebar: "Approvals", nav: sidebar + top bar, approver-only)
- `/approvals/[id]` — Report Detail (nav: sidebar + breadcrumb back to queue)
- `/admin/audit` — Admin Audit Log (sidebar: "Audit Log", nav: sidebar + top bar, admin-only)
- `/admin/policies` — Policy Configuration (sidebar: "Policies", nav: sidebar + top bar, admin-only)

Public, unauthenticated, content-indexable surface: no — all pages require authentication.

## Components

Core components and responsibilities:
- `ExpenseForm` — multi-step form for creating/editing expense reports with line items and receipt uploads
- `ReceiptDropzone` — drag-drop zone for receipt files (PDF, JPG, PNG, HEIC) with per-file progress bars
- `LineItemRow` — editable row for a single expense line item (date, vendor, category, amount, description)
- `PolicyBadge` — inline badge showing policy violation status (pass, warning, violation) with tooltip explanation
- `ReportCard` — summary card for My Reports list showing title, total, status badge, submitted date
- `ApprovalRow` — queue row showing submitter name, total, submitted date, policy flag count, urgency indicator
- `AuditEntry` — timeline entry showing actor, action, target, timestamp, and context details
- `StatusBadge` — reusable badge for report status (draft, pending, approved, rejected, changes-requested)

## State

State management approach:
- Server state: Remix loaders fetch data on navigation; actions handle mutations with automatic revalidation
- Form state: Remix `useActionData` for server validation errors, `useState` for client-side draft state
- Draft persistence: autosave every 5 seconds to `localStorage` AND `POST /api/reports/draft` when authenticated
- Auth state: Auth0 session managed server-side via `remix-auth` with session cookie; client reads user from loader data
- Notification state: polling every 30 seconds via a background Remix loader for unread notification count

## Styling

Design tokens:
- Colors: white background (`#FFFFFF`), slate text (`#334155`), blue primary (`#2563EB`), red error (`#DC2626`), green success (`#16A34A`)
- Typography: Inter for all text, tabular numbers for amounts
- Spacing: 4px base unit, 48px row height for approval queue
- Borders: 1px solid `#E2E8F0` for cards and inputs, 4px border-radius
- CSS approach: Tailwind CSS with a corporate theme preset

# Backend

The backend is an Express.js application running on Node.js 20. MongoDB is the primary data store via Mongoose ODM. Auth0 handles authentication; the Express app validates JWTs on every request via `express-oauth2-jwt-bearer`.

## Services

Service boundaries:
- **Auth Service** — Auth0 integration, JWT validation, role resolution from Auth0 user metadata
- **Report Service** — expense report CRUD, draft persistence, policy validation at submit time
- **Receipt Service** — multipart file upload to S3-compatible storage (Render Object Storage), file type validation
- **Approval Service** — approval queue, approve/reject/request-changes actions, approver routing via org chart
- **Audit Service** — append-only audit log writes, query interface for admin timeline view
- **Policy Service** — CRUD for spend policies, policy evaluation engine for submit-time validation

## API Contracts

**POST /api/receipts/upload**
- Request: multipart form data with `file` field (PDF, JPG, PNG, HEIC, max 10MB per file)
- Response: `{ receipt_id: string, url: string, thumbnail_url: string, file_name: string, size_bytes: number }`
- Auth required: yes
- Error codes: 400 (unsupported format or exceeds 10MB), 401 (unauthenticated), 413 (payload too large), 500 (storage unavailable)

**POST /api/reports**
- Request: `{ title: string, line_items: [{ date: string, vendor: string, category: string, amount: number, currency: string, description: string }], receipt_ids: string[], idempotency_key: string }`
- Response: `{ report_id: string, status: "pending_approval", submitted_at: string, approver_name: string }`
- Auth required: yes
- Error codes: 400 (validation errors), 401 (unauthenticated), 409 (idempotency key collision), 422 (policy violation without justification)

**GET /api/approvals/queue**
- Request: query params `?status=pending&sort=urgency|submitted_at&cursor=string&limit=number`
- Response: `{ reports: [{ id: string, submitter_name: string, total: number, submitted_at: string, policy_flag_count: number, urgency: "normal" | "high" }], next_cursor: string | null }`
- Auth required: yes (approver role)
- Error codes: 401 (unauthenticated), 403 (not an approver)

**POST /api/reports/{id}/approve**
- Request: `{ comment: string | null, idempotency_key: string }`
- Response: `{ report_id: string, status: "approved", approved_at: string, approved_by: string }`
- Auth required: yes (approver role)
- Error codes: 400 (invalid report state), 401 (unauthenticated), 403 (not assigned approver), 404 (report not found), 409 (already actioned)

**POST /api/reports/{id}/reject**
- Request: `{ reason: string, idempotency_key: string }` (reason min 20 characters)
- Response: `{ report_id: string, status: "rejected", rejected_at: string, rejected_by: string }`
- Auth required: yes (approver role)
- Error codes: 400 (reason too short or invalid state), 401 (unauthenticated), 403 (not assigned approver), 404 (report not found), 409 (already actioned)

**GET /api/policies**
- Request: query params `?category=string&active=boolean`
- Response: `{ policies: [{ id: string, name: string, category: string, max_amount: number, requires_justification_above: number, active: boolean }] }`
- Auth required: yes
- Error codes: 401 (unauthenticated), 500 (database unavailable)

**GET /api/users/{user_id}/manager**
- Request: path param `user_id`
- Response: `{ manager: { id: string, name: string, email: string } | null }`
- Auth required: yes
- Error codes: 401 (unauthenticated), 404 (user not found)

## Persistence

Data layer uses MongoDB via Mongoose ODM. Collections map 1:1 to domain entities. Indexes are defined in Mongoose schemas and synced on application startup via `syncIndexes()`.

Connection: MongoDB Atlas (M10 shared cluster for staging, M30 dedicated for production). Connection string via `MONGODB_URI` env var. Connection pooling: Mongoose default pool size of 5, increased to 20 for production.

No ORM abstraction beyond Mongoose — queries use Mongoose query builder for reads and `Model.create()` / `Model.findOneAndUpdate()` for writes.

# Data Model

## Entities

**User**
- Fields: _id: ObjectId, auth0_id: string, email: string, display_name: string, role: enum('end-user','approver','admin'), manager_id: ObjectId (FK → User), department: string, created_at: Date, updated_at: Date
- Indexes: idx_users_auth0_id (unique), idx_users_email (unique), idx_users_manager_id

**ExpenseReport**
- Fields: _id: ObjectId, submitter_id: ObjectId (FK → User), approver_id: ObjectId (FK → User), title: string, line_items: [{ date: Date, vendor: string, category: string, amount: number, currency: string, description: string, justification: string }], receipt_ids: ObjectId[], total: number, status: enum('draft','pending_approval','approved','rejected','changes_requested'), policy_violations: [{ line_item_index: number, rule_name: string, message: string }], idempotency_key: string, submitted_at: Date, resolved_at: Date, approver_comment: string
- Indexes: idx_reports_submitter_id, idx_reports_approver_id, idx_reports_status, idx_reports_submitted_at, idx_reports_idempotency_key (unique)

**LineItem**
- Fields: _id: ObjectId, report_id: ObjectId (FK → ExpenseReport), date: Date, vendor: string, category: string, amount: number, currency: string, description: string, justification: string, receipt_id: ObjectId
- Indexes: idx_line_items_report_id, idx_line_items_category

**AuditLogEntry**
- Fields: _id: ObjectId, actor_id: ObjectId (FK → User), actor_name: string, action: enum('submit','approve','reject','request_changes','override','policy_violation_logged'), target_type: enum('report','policy','user'), target_id: ObjectId, context: { prior_status: string, new_status: string, reason: string, line_item_ids: ObjectId[] }, timestamp: Date
- Indexes: idx_audit_actor_id, idx_audit_target_id, idx_audit_action, idx_audit_timestamp

## Migrations

Migration strategy: MongoDB does not use traditional SQL migrations. Schema changes are handled via Mongoose schema versioning and application-level migration scripts in `scripts/migrations/`. Each script is idempotent and can be re-run safely.

For breaking changes (field renames, type changes), a migration script runs as a one-time job on Render before the new application version starts. Non-breaking changes (new optional fields) are handled by Mongoose schema defaults.

Seed data: development seed script populates 5 end-users, 2 approvers, 1 admin, 15 expense reports across various statuses, and 30 audit log entries.

# Security

## Auth

Authentication via Auth0 with OIDC. Users authenticate through Auth0's Universal Login page; the Remix app receives an authorization code and exchanges it for tokens server-side. Access tokens are JWTs validated by Express middleware (`express-oauth2-jwt-bearer`).

Authorization model:
- Role-based access: `end-user`, `approver`, `admin` roles stored in Auth0 user metadata and included in the JWT `roles` claim
- Route-level middleware checks role before handler execution
- Approver scope: approvers can only see reports from their direct reports (resolved via `manager_id` on User)
- Admin override: admins can approve reports that exceed the $500 policy threshold

## Input Validation

All Express routes use `express-validator` middleware for input validation. Validation runs before any database query.

Specific rules:
- Receipt files: MIME type check (application/pdf, image/jpeg, image/png, image/heic), max 10MB per file, max 50MB per report
- Line item amounts: positive numbers, max 2 decimal places, max $100,000 per line item
- Report title: 1-200 characters, no HTML tags
- Reject reason: minimum 20 characters
- Idempotency key: UUID v4 format, required on all mutation endpoints

## Secrets

Secret storage: Render environment variables for production, `.env` for development. Secrets never committed to git.

Required secrets:
- `AUTH0_DOMAIN` — Auth0 tenant domain — config — required
- `AUTH0_CLIENT_ID` — Auth0 application client ID — config — required
- `AUTH0_CLIENT_SECRET` — Auth0 application client secret — secret — required
- `AUTH0_AUDIENCE` — Auth0 API audience identifier — config — required
- `MONGODB_URI` — MongoDB Atlas connection string — secret — required
- `SESSION_SECRET` — Express session signing key — secret — required
- `S3_BUCKET` — Render Object Storage bucket name — config — required
- `S3_ACCESS_KEY` — Render Object Storage access key — secret — required

Rotation: Auth0 client secret rotated quarterly. MongoDB credentials rotated via Atlas automated rotation. Session secret rotated on deploy via Render's secret management.

# Infrastructure

## Deployment

Deployment target: Render (Web Service for the Express+Remix app).
- Automatic deploys from `main` branch via Render's GitHub integration
- Preview environments on PRs via Render Preview Environments
- Environment strategy: `development` (local), `preview` (Render PR deploys), `production` (Render production)
- CI/CD: GitHub Actions for lint + type-check + test on PR; Render handles build + deploy

## Caching

- CDN: Render's built-in CDN for static assets (CSS, JS bundles, images)
- API responses: no edge caching — all API responses are user-scoped and require auth
- Client-side: Remix loader data cached per navigation via Remix's built-in cache; no additional client cache layer
- Database: MongoDB Atlas in-memory cache for frequently accessed policies (read-heavy, write-rare)

## Background Jobs

- Approver notification: Express event emitter triggers email send via SendGrid on report submission — delivered within 2 minutes
- Audit log write: synchronous write in the same request transaction as the approval action — no background job needed for v1
- SLA reminders: Render Cron Job runs every hour, queries reports where `submitted_at < now() - 24h` and status is `pending_approval`, sends reminder email to approver
- Policy violation logging: synchronous — violations detected at submit time are written to audit log in the same request

## Env Vars

- `AUTH0_DOMAIN` — Auth0 tenant domain — config — required
- `AUTH0_CLIENT_ID` — Auth0 application client ID — config — required
- `AUTH0_CLIENT_SECRET` — Auth0 application client secret — secret — required
- `AUTH0_AUDIENCE` — Auth0 API audience identifier — config — required
- `MONGODB_URI` — MongoDB Atlas connection string — secret — required
- `SESSION_SECRET` — Express session signing key — secret — required
- `S3_BUCKET` — Render Object Storage bucket name — config — required
- `S3_ACCESS_KEY` — Render Object Storage access key — secret — required
- `SENDGRID_API_KEY` — SendGrid API key for transactional emails — secret — required in production
- `NODE_ENV` — Node environment identifier — config — auto-set by Render

# Scope

In scope for v1:
- Expense Submission: receipt upload (drag-drop + mobile camera), line item entry, policy validation at submit, draft autosave, idempotent submission
- Approval Workflow: approval queue with policy flags visible at queue level, approve/reject/request-changes with audit trail, bulk approve with individual audit entries
- Audit Log: admin-only timeline of all submission and approval events with full context, 7-year retention

# Out of Scope

Deferred to v2 or later:
- Receipt OCR for auto-filling line items (v1: manual entry only)
- Multi-currency conversion (v1: single currency per org, set in admin settings)
- HRIS integration for org chart sync (v1: manager set manually in user profile)
- Mobile native app (v1: responsive web only)
- Reimbursement payment processing (v1: approved reports exported as CSV for payroll)
- Custom approval chains (v1: single-level manager approval only)
- SSO via SAML (v1: Auth0 Universal Login with email/password + social)
- Slack/Teams integration for notifications (v1: email only)
