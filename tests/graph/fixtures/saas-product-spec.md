# Product Spec

## App Overview

ExpenseFlow is a B2B expense reporting tool for small-to-mid teams. End-users submit expense reports with receipts, approvers (typically managers) review and approve or reject them, and admins configure spend policies and audit the activity log. The platform's value proposition is reducing approval cycle time from days to hours by routing reports to the right approver automatically and surfacing policy violations at submit-time rather than weeks later in audit.

| Persona | Role | Primary JTBD | Relationship to Other Personas |
|---------|------|--------------|--------------------------------|
| End-User (primary) | Employee submitting expense reports | Submit a compliant expense report and get reimbursed without back-and-forth | Submits to Approver; subject to policies set by Admin |
| Approver | Manager reviewing expense reports | Approve or reject team expenses quickly with confidence the policy was checked | Reviews End-User submissions; policies set by Admin; actions logged for Admin audit |
| Admin | Finance ops administrator configuring policies | Set spend policies and audit approval activity to satisfy compliance | Sets rules that constrain End-User and Approver workflows; reads audit log of both |

## Screen Inventory

| Screen | Description | Features |
|--------|-------------|----------|
| Submit Expense | End-user form to upload receipts and enter line items | Expense Submission |
| My Reports | End-user list of submitted reports with status | Expense Submission |
| Approval Queue | Approver inbox of pending reports needing review | Approval Workflow |
| Report Detail | Shared view used by approvers and admins to inspect a single report | Approval Workflow |
| Admin Audit Log | Admin-only timeline of all submission and approval events | Approval Workflow |

## Permissions & Roles

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| End-User | Submit reports, view own reports, attach receipts | Approve reports, view other users' reports, configure policies |
| Approver | View team's reports, approve/reject with comment, request changes | View reports outside their direct reports, edit policies |
| Admin | Configure policies, view all reports, view audit log, override approvals | Submit expense reports for other users (admin must use End-User role to submit) |

## Cross-Feature Interactions

- Expense Submission (End-User) → Approval Workflow (Approver): submitted report routes to direct manager based on org chart, approver notified within 2 minutes
- Approval Workflow (Approver) → Expense Submission (End-User): end-user notified when status changes (approved, rejected, changes-requested)
- Approval Workflow (Approver) → Approval Workflow (Admin): every approve/reject/override action writes to admin audit log within 30s
- Expense Submission (End-User) → Approval Workflow (Admin): submission with policy violations flagged in audit log immediately, even before approver action

## Feature: Expense Submission

### States
States: drafting (initial), uploading-receipts, validating, ready-to-submit, submitting, submitted, rejected-with-changes, error

### Transitions
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| drafting → uploading-receipts | User selects receipt files | Files match accepted formats (PDF, JPG, PNG, HEIC) | POST /api/receipts/upload (multipart) |
| uploading-receipts → drafting | All uploads complete | At least 1 successful upload | Attach receipt URLs to draft report |
| uploading-receipts → error | Upload fails for any file | — | Show per-file error, retain successfully uploaded receipts |
| drafting → validating | Click "Submit" | All required fields filled, ≥ 1 line item | Run client-side policy check |
| validating → ready-to-submit | All policy checks pass | — | Show submit confirmation modal |
| validating → drafting | Policy violation found | — | Show inline violation messages on offending line items |
| ready-to-submit → submitting | Confirm in modal | — | POST /api/reports |
| submitting → submitted | API 201 | — | Show success toast, route to My Reports, notify approver |
| submitting → error | API 4xx/5xx or 30s timeout | — | Show error banner, preserve form state |
| submitted → rejected-with-changes | Approver requests changes | Approver action via Approval Workflow | Email end-user, surface report in My Reports with red badge |
| rejected-with-changes → drafting | User clicks report to edit | Report status is "Changes Requested" | Load report data into form |

### Data Requirements
- drafting: form state {report_title, line_items[{date, vendor, category, amount, currency, description}], receipts[{file_id, url, thumbnail_url}], policy_warnings[]}
- uploading-receipts: per-file progress {file_id, percent, status: uploading|complete|failed}
- validating: client-side policy results from local rule engine using policies fetched at session start via GET /api/policies
- ready-to-submit: report payload preview, total amount, estimated approver name from GET /api/users/{user_id}/manager
- submitting: idempotency key generated client-side
- submitted: report {id, status, submitted_at, approver_name} from POST /api/reports response
- rejected-with-changes: report data plus approver_comment and changes_requested[] (specific line items flagged)
- error: error message string, preserved form state

### Failure Modes
- Receipt upload fails for one or more files →
  User sees: Per-file inline error: "Couldn't upload {filename}. The file may be over 10MB or in an unsupported format."
  User can: Retry the failed file, remove it, swap a different file
  System: Retain successfully uploaded receipts, do NOT clear the form, do NOT block submission if other receipts uploaded

- Policy violation detected at submit time →
  User sees: Inline error on the offending line item: "This $185 dinner exceeds the $75 meal cap. Add a justification or reduce the amount."
  User can: Add justification text, edit amount, remove line item
  System: Block submission until either justification provided or amount within policy; log violation for admin audit even if user resolves it client-side

- Network failure during submit →
  User sees: "We couldn't submit your report. Your draft is saved — try again when your connection is stable."
  User can: Retry, save draft and submit later
  System: Persist draft to local storage, preserve idempotency key, do NOT create partial report server-side

- Approver requests changes after submission →
  User sees: Email + in-app notification. Report card in My Reports shows "Changes Requested" red badge with approver comment preview.
  User can: Click report to edit, address comments, resubmit
  System: Re-route to same approver on resubmit, preserve original submission timestamp

### Business Rules
- Maximum receipt file size: 10MB per file, 50MB total per report
- Accepted receipt formats: PDF, JPG, PNG, HEIC
- Maximum line items per report: 50
- Default currency: user's profile currency, override per line item allowed
- Policy violations block submit unless justification > 20 characters provided
- Draft autosave: every 5 seconds during editing, persisted to local storage AND POST /api/reports/draft if user authenticated
- Idempotency: submit uses client-generated UUID, retries with same UUID return original report
- Receipt OCR: [DECISION NEEDED: Should we run OCR on uploaded receipts to pre-fill line items? Suggest: yes, optional — let user accept or override OCR results]
- Approver routing: based on org chart from HRIS sync, fallback to manager-of-record set in profile
- Submission cutoff: reports for prior month must be submitted by 15th of current month — enforced client-side warning, not blocked

### Happy Path
1. User lands on Submit Expense screen. Sees: empty form with "+ Add line item" CTA, drag-drop zone for receipts, policy summary in sidebar. Can: drag receipts, click add line item, type report title.
2. User drops 3 receipt images. Sees: thumbnails appear with upload progress bars, OCR runs on each producing pre-filled line item drafts. Can: accept OCR suggestions, edit fields, dismiss suggestion.
3. User reviews and adjusts line items. Sees: running total, currency converted to home currency if mixed. Can: split line items by category, add justifications.
4. User clicks "Submit." Sees: validating spinner briefly, then confirmation modal with approver name and total. Can: confirm, go back to edit.
5. User confirms. Sees: success toast "Report submitted to {approver name}", redirected to My Reports with new report at top showing "Pending Approval" status.

### Persona Constraints
- Persona: End-User (primary) — submits monthly, doesn't want to learn finance jargon [ux-research.md]
  Constraint: policy violations must explain in plain language with specific dollar amounts — abstract "exceeds policy" copy in v0 had 60% support ticket rate [ux-research.md, feature-intel.md]
  Constraint: receipt upload must support drag-drop AND mobile camera capture — 70% of receipts come from phones [feature-intel.md]
  Constraint: draft must autosave so users don't lose work when interrupted — top complaint in v0 NPS surveys [ux-research.md]
- Persona: Admin — needs every submission tracked even when end-user resolves violations client-side [ux-research.md]
  Constraint: every policy violation that the user encounters at submit must be logged to the audit log even if the user then corrects the line item — compliance requirement [feature-intel.md]

### Empty/Loading/Error States
- Empty form (initial): Form is empty by design — "Drag receipts or use camera to start" CTA in upload zone, "+ Add line item" button below.
- Loading (during upload): Per-file progress bars on each receipt thumbnail, form remains editable for other fields.
- Loading (during validation): "Validating..." button text replacing "Submit", spinner on button, form locked briefly (< 500ms).
- Error (upload): Inline per-file: "Couldn't upload {filename}." with retry icon. Other receipts unaffected.
- Error (submit): Banner at top of form: "We couldn't submit your report. Please try again." with retry button. Form state preserved.

### Notification Triggers
- Report submitted → Approver email + in-app push (within 2 minutes): summary, total, link to Report Detail
- Report submitted → Admin audit log (within 30s): event type, user, total, policy_violations[]
- Changes requested → End-user email + in-app push (within 5 minutes of approver action): comment, link to edit
- Approved → End-user email (within 5 minutes): confirmation, expected reimbursement date

### Acceptance Criteria
- [ ] Verify that draft autosaves every 5 seconds during editing
- [ ] Verify that policy violations show plain-language explanations with specific dollar amounts
- [ ] Verify that receipt upload supports drag-drop on web and camera capture on mobile
- [ ] Verify that submission with policy violations is blocked until justification > 20 characters is provided
- [ ] Verify that approver receives notification within 2 minutes of submission
- [ ] Verify that retry of failed submit uses the original idempotency key and does not create duplicates

## Feature: Approval Workflow

### States
States: queue-empty (initial), queue-loaded, reviewing, approving, approved, rejecting, rejected, requesting-changes, changes-requested, error

### Transitions
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| queue-empty → queue-loaded | New report routed to approver | Approver authenticated, has direct reports | Fetch GET /api/approvals/queue |
| queue-loaded → reviewing | Click report row | Report not already actioned | Fetch GET /api/reports/{id} |
| reviewing → approving | Click "Approve" | All required fields visible, no unresolved policy flags | Show confirmation modal with optional comment |
| approving → approved | Confirm approve | — | POST /api/reports/{id}/approve, write to audit log, notify end-user |
| reviewing → rejecting | Click "Reject" | Reject reason field non-empty | Show confirmation modal with required reason |
| rejecting → rejected | Confirm reject | Reason text > 20 characters | POST /api/reports/{id}/reject, write to audit log, notify end-user |
| reviewing → requesting-changes | Click "Request Changes" + comment | Comment text non-empty, references specific line items | Show confirmation modal |
| requesting-changes → changes-requested | Confirm | — | POST /api/reports/{id}/request-changes, write to audit log, notify end-user |
| approving → error | API 4xx/5xx | — | Show error banner, preserve modal state, allow retry |
| rejecting → error | API 4xx/5xx | — | Show error banner, preserve reason text |
| error → reviewing | Click "Try Again" or dismiss | — | Re-issue last action with same idempotency key |

### Data Requirements
- queue-loaded: pending reports [{id, submitter_name, total, submitted_at, policy_flag_count, urgency}] from GET /api/approvals/queue
- reviewing: full report {id, submitter, line_items[], receipts[], total, policy_violations[], audit_history[]} from GET /api/reports/{id}
- approving: optional comment input, no display data beyond modal
- approved: confirmation message, returns to queue with approved report removed
- rejecting: required reason input (min 20 chars), no other display data
- rejected: confirmation message, returns to queue
- requesting-changes: required comment input referencing line items, line item picker
- changes-requested: confirmation message, returns to queue
- error: error message string, preserved modal state and inputs

### Failure Modes
- Network failure during approve action →
  User sees: "We couldn't approve this report. Please try again." in modal
  User can: Retry, cancel and re-open report, work on next report
  System: Preserve comment text, idempotency key reused on retry — never double-write to audit log

- Report already actioned by another approver (race condition) →
  User sees: "This report was already {approved|rejected} by {other approver}. Refresh to see latest."
  User can: Refresh, navigate to next report in queue
  System: Surface stale-state error gracefully, do NOT overwrite the prior action

- Policy override required but approver lacks override permission →
  User sees: "This report has a $500+ policy violation that requires Admin override. Forwarding to Admin queue."
  User can: Acknowledge, navigate away
  System: Auto-route report to admin queue, write routing event to audit log

- Audit log write fails after approval succeeds →
  User sees: Approval shows as successful in UI
  User can: Continue working — failure is invisible to approver
  System: Background retry queue for audit log writes — log failure to ops alerting if retry exhausts after 3 attempts. Approval state on report is canonical; audit log is eventually consistent.

### Business Rules
- Approval SLA: approver notified within 2 minutes of submission, expected to action within 48 business hours
- Reject reason: minimum 20 characters required
- Change request: must reference at least one specific line item (line_item_ids[])
- Audit log retention: 7 years for compliance
- Override threshold: reports with policy violations > $500 require admin override, not just approver approval
- Bulk action: approver can select multiple reports and approve in one click — each still writes individual audit log entry
- Concurrent approvers: if a report routes to multiple approvers (rare), first action wins, others see stale-state error
- Reminder cadence: unactioned reports trigger approver reminder email at 24h and 47h post-routing

### Happy Path
1. Approver lands on Approval Queue. Sees: list of pending reports sorted by urgency (submitter, total, submitted-when, policy flags). Can: click row, bulk-select, filter by team member.
2. Approver clicks a report. Sees: full report detail — line items, receipts, totals, submitter notes, policy violation badges (if any), audit history. Can: approve, reject, request changes.
3. Approver clicks "Approve." Sees: confirmation modal with optional comment field, "Approve" and "Cancel" buttons. Can: add comment or skip, confirm.
4. Approver confirms. Sees: success toast "Approved. {submitter name} notified." Returns to queue, the report has been removed from the queue.
5. Background. Audit log written within 30s. End-user notified within 5 minutes by email.

### Persona Constraints
- Persona: Approver — has 5-50 reports per month, wants to action quickly without missing red flags [ux-research.md, feature-intel.md]
  Constraint: policy violations must be visible at queue level, not buried in detail — approvers in v0 routinely missed flagged reports because flags were only in detail view [ux-research.md]
  Constraint: bulk approve must be supported but each action still produces individual audit entry — managers requested bulk action while compliance requires individual records [ux-research.md, feature-intel.md]
  Constraint: required reject reason must enforce minimum 20 characters — reject reasons in v0 were often "no" or empty, blocking end-user from understanding what to fix [ux-research.md]
- Persona: End-User (primary) — needs to know what to fix when changes are requested [ux-research.md]
  Constraint: change request must reference specific line items so end-user can find them — "fix this report" with no line item reference forced end-users to guess [ux-research.md]
- Persona: Admin — needs every action recorded for compliance [feature-intel.md]
  Constraint: every approve, reject, request-changes, and override must write to audit log within 30s with full context (actor, target, reason, prior state) — SOC2 audit requirement [feature-intel.md]

### Empty/Loading/Error States
- Empty queue: "No pending approvals. You're all caught up." with subtle illustration. CTA: "View team activity" linking to a team summary view.
- Loading queue: Skeleton rows matching final layout, no spinner.
- Loading report detail: Skeleton sections for line items, receipts, audit history.
- Error queue load: "We couldn't load your queue. Please refresh." with refresh button. Last cached queue shown below with "Last updated 5 minutes ago" stale indicator.
- Error action (approve/reject/changes): Inline error in modal: "We couldn't {action}. Please try again." Modal stays open, inputs preserved.

### Notification Triggers
- Report routed to approver → Approver email + in-app push (within 2 minutes of submission): summary, total, link
- Report unactioned 24h → Approver email reminder: "{N} reports waiting for your review"
- Report unactioned 47h → Approver email + admin CC: SLA breach warning
- Action completed (approve/reject/request-changes) → End-user email (within 5 minutes): outcome, comment, next steps
- Override forwarded to admin → Admin email + in-app push (immediate): report summary, original approver, violation details

### Acceptance Criteria
- [ ] Verify that policy violation flags are visible in the queue, not just in report detail
- [ ] Verify that reject requires a reason of at least 20 characters
- [ ] Verify that change requests reference specific line items
- [ ] Verify that bulk approve writes individual audit log entries per report
- [ ] Verify that audit log entries are written within 30 seconds of the approver action
- [ ] Verify that race-condition (already-actioned report) shows a stale-state message instead of overwriting the prior action
- [ ] Verify that reports with $500+ policy violations route to admin override, not approver approval
