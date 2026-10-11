# Expense Voucher Management System — Design

**Date:** 2026-10-12
**Status:** Approved
**Context:** Full Stack Developer Internship assignment, Prachay Securities Private Limited.

## 1. Purpose

Replace a manual, paper-based expense reimbursement process with a web application. An employee creates an expense voucher and submits it for approval, the Director approves or rejects it, and the Accounts Team monitors approved vouchers for reimbursement. Every user sees only what their role permits.

The assignment is graded on frontend development, backend development, authentication, authorization, database design, REST API design, file uploads, validation, and clean software architecture. The design therefore favours explicit boundaries and server-enforced rules over cleverness or brevity.

### Success criteria

- All three roles can complete their full workflow end to end against a running Postgres database.
- Authorization is enforced on the server. No endpoint relies on the client to scope data or to hide an action.
- Every validation and business rule listed in the assignment is enforced in the backend, and surfaced in the UI before submission where possible.
- A reviewer can clone the repository, follow the README, and have the application running with seeded users.
- The repository contains migration files, a `.env.example` for each package, and a README covering setup, schema, API documentation, and assumptions.

### Out of scope

Email notification, multi-level approval chains, delegation, currency conversion, voucher line items, OCR of receipts, audit-log viewing UI, password reset, and self-service registration. Users are created by the seed script, which matches the assignment: it specifies a login screen and three fixed roles, and never mentions sign-up.

## 2. Technology choices

| Layer | Choice | Reason |
|---|---|---|
| Backend | Node.js, Express 5, TypeScript | Stated minimum expectation. Express keeps the surface small relative to NestJS, leaving time for features. |
| ORM | Prisma | Produces the migration files the submission requires, and a single readable schema file that doubles as the schema documentation. |
| Database | PostgreSQL 16 | Preferred by the assignment. Also supplies the sequence used for voucher numbering and the `Decimal` type used for money. |
| Frontend | React 19 + TypeScript + Vite | React is preferred by the assignment. Vite gives a dev proxy, which keeps the API same-origin in development and so keeps cookie auth simple. |
| Routing | React Router | Needed for the protected-route requirement. |
| Forms | React Hook Form + Zod | The same Zod schemas describe the payloads on both sides, so client and server validation cannot drift. |
| Styling | Tailwind CSS | Responsive design is a requirement; utility classes get there without a component-library dependency. |
| Uploads | Multer, local disk | Signature images are small. Local disk avoids an S3 dependency for a gradeable exercise. |
| Tests | Vitest + Supertest | Fast, TypeScript-native, and Supertest exercises the real Express app including middleware. |

NestJS was considered and rejected: it satisfies the same requirement but costs noticeably more boilerplate for this endpoint count. A Next.js fullstack app was rejected because it collapses the frontend/backend separation the assignment is explicitly evaluating.

## 3. Repository layout

```
prachay/
  docker-compose.yml              Postgres service only
  README.md
  docs/superpowers/specs/
  backend/
    .env.example
    prisma/
      schema.prisma
      migrations/
      seed.ts
    uploads/signatures/           gitignored, .gitkeep tracked
    src/
      config/env.ts               Zod-validated environment, fails fast at boot
      lib/prisma.ts
      lib/errors.ts               AppError and its subclasses
      lib/asyncHandler.ts
      lib/voucherNumber.ts
      middleware/authenticate.ts
      middleware/requireRole.ts
      middleware/validate.ts
      middleware/upload.ts
      middleware/errorHandler.ts
      modules/auth/               routes, controller, service, schemas
      modules/vouchers/           routes, controller, service, schemas
      modules/signatures/         routes, controller, service
      modules/dashboard/          routes, controller, service
      app.ts                      builds the Express app, no listen
      server.ts                   reads config, listens
    tests/
  frontend/
    .env.example
    src/
      api/client.ts
      api/vouchers.ts, auth.ts, dashboard.ts, signatures.ts
      auth/AuthContext.tsx
      auth/ProtectedRoute.tsx
      pages/login/
      pages/employee/             Dashboard, CreateVoucher, MyVouchers, EditVoucher
      pages/director/             Dashboard, PendingApprovals, AllVouchers
      pages/accounts/             Dashboard, AllVouchers
      pages/shared/               VoucherDetails
      components/
      types/
```

`app.ts` is kept separate from `server.ts` so that Supertest can mount the application without binding a port.

## 4. Data model

### User

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `email` | text, unique | Login identifier. |
| `passwordHash` | text | bcrypt, cost 12. |
| `name` | text | Rendered as "Employee Name" on vouchers. |
| `employeeCode` | text, nullable | The assignment marks Employee ID optional. |
| `department` | text, nullable | Pre-fills the voucher form; the voucher stores its own copy. |
| `role` | enum `EMPLOYEE \| DIRECTOR \| ACCOUNTS` | |
| `createdAt`, `updatedAt` | timestamptz | |

### Signature

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `ownerId` | uuid, fk → User | Who uploaded it. |
| `filePath` | text | Path relative to the uploads root. |
| `mimeType` | text | `image/png`, `image/jpeg`, or `image/webp`. |
| `sizeBytes` | int | |
| `createdAt` | timestamptz | |

A signature is a row rather than a column on `User` so that a voucher can hold a permanent reference to the exact image it was signed with.

### Voucher

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `voucherNumber` | text, unique | `VCH-<year>-<6-digit sequence>`. |
| `voucherDate` | date | Defaults to the creation date. |
| `expenseDate` | date | Mandatory. |
| `department` | text | Mandatory. Copied from the user at creation, editable while in draft. |
| `title` | text | Mandatory. |
| `category` | enum | `TRAVEL`, `MEALS`, `ACCOMMODATION`, `OFFICE_SUPPLIES`, `CLIENT_ENTERTAINMENT`, `TRAINING`, `COMMUNICATION`, `OTHER`. |
| `description` | text, nullable | |
| `amount` | `Decimal(12,2)` | Must be greater than zero. |
| `status` | enum `DRAFT \| PENDING_APPROVAL \| APPROVED \| REJECTED` | |
| `createdById` | uuid, fk → User | The employee who owns the voucher. |
| `employeeSignatureId` | uuid, fk → Signature, nullable | Required to leave `DRAFT`. |
| `directorSignatureId` | uuid, fk → Signature, nullable | Required to reach `APPROVED`. |
| `reviewedById` | uuid, fk → User, nullable | The Director who approved or rejected. |
| `submittedAt` | timestamptz, nullable | |
| `approvalDate` | timestamptz, nullable | |
| `rejectionReason` | text, nullable | Required to reach `REJECTED`. |
| `createdAt`, `updatedAt` | timestamptz | The assignment's audit fields. |

Indexes: unique on `voucherNumber`; composite on `(createdById, status)` for the employee list and dashboard; single-column on `status`, `expenseDate`, `amount`, and `department` for the Director and Accounts filters.

Money is `Decimal`, not float. Reimbursement totals are summed and displayed, and binary floating point would produce visible rounding errors. The API serializes decimals as strings to avoid losing precision in JavaScript, and the frontend formats them for display with `Intl.NumberFormat`.

### Three pinned decisions

1. **"Submitted" and "Pending Approval" are a single state.** The assignment's workflow diagram lists both, but nothing distinguishes them: no action happens between them and no rule refers to one without the other. Submitting is the action; `PENDING_APPROVAL` is the resulting status; the UI labels it "Pending Approval". This is recorded in the README's assumptions.
2. **Voucher numbers come from a Postgres sequence.** A dedicated `voucher_number_seq`, created in the initial migration, is read with `nextval` inside the creation transaction and formatted into the display string. Deriving the number from `count() + 1` races under concurrent creation and would break the uniqueness rule the assignment states first.
3. **A voucher references its signatures; it does not read them from the user.** If signatures lived on `User`, an employee replacing their signature would retroactively alter the appearance of vouchers the Director already approved. Referencing the signature row per voucher keeps approved records immutable, which matches business rule 7.

## 5. Authentication and authorization

Login verifies the password with bcrypt and issues a JWT containing `sub`, `role`, and `email`, signed with `JWT_SECRET` and expiring in 8 hours. The token is set as an httpOnly, SameSite=Strict cookie, `Secure` outside development.

The httpOnly cookie is chosen over returning the token for `localStorage` because a token in `localStorage` is readable by any injected script. SameSite=Strict also means the browser will not attach the cookie to cross-site requests, which covers the CSRF exposure that cookie auth would otherwise introduce. In development the Vite proxy forwards `/api` to the backend, so requests are same-origin and the strict cookie works without special handling.

`authenticate` verifies the cookie, loads the user, and attaches it to the request; a missing or invalid token is a 401. `requireRole(...roles)` is a second, separate middleware returning 403, so the route definitions read as an explicit permission table.

The signature-image rule needs stating precisely, because an employee must be able to preview a signature they have just uploaded and not yet attached to anything. A caller may fetch a signature image when they own it, when they are a Director or Accounts user, or when it is attached to a voucher they are permitted to see. Every other request is a 404.

Row-level scoping is applied in the service layer, not the controller. Every voucher query for an `EMPLOYEE` has `createdById = currentUser.id` forced into the `where` clause, and the detail, update, delete, and submit paths re-check ownership after loading. An employee cannot reach another employee's voucher by guessing an id, and cannot widen their own list by sending extra query parameters.

The permission table the routes implement:

| Action | Employee | Director | Accounts |
|---|---|---|---|
| Create voucher | yes | no | no |
| Edit or delete draft | own only | no | no |
| Submit | own only | no | no |
| List vouchers | own only | all | all |
| View detail | own only | all | all |
| Approve or reject | no | yes | no |
| Upload own signature | yes | yes | no |
| View signature image | own signatures, and those on own vouchers | all | all |

## 6. API

All responses are JSON. Errors share one shape, produced by a single error-handling middleware:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Amount must be greater than zero", "details": [] } }
```

Status codes: 400 for validation failure, 401 for missing or invalid authentication, 403 for a role or ownership violation, 404 for a missing resource or one the caller may not see, 409 for an illegal state transition, 413 for an oversized upload, 415 for an unsupported image type, and 500 for anything unhandled.

### Endpoints

```
POST   /api/auth/login              { email, password } → user; sets cookie
POST   /api/auth/logout             clears cookie
GET    /api/auth/me                 current user

POST   /api/signatures              multipart/form-data, field "image" → signature
GET    /api/signatures/:id/image    streams the image, authorization checked

GET    /api/vouchers                paginated list, filters below
POST   /api/vouchers                EMPLOYEE, creates DRAFT
GET    /api/vouchers/:id            detail with creator, reviewer, signature ids
PATCH  /api/vouchers/:id            EMPLOYEE, own, DRAFT only
DELETE /api/vouchers/:id            EMPLOYEE, own, DRAFT only
POST   /api/vouchers/:id/submit     EMPLOYEE, own, DRAFT → PENDING_APPROVAL
POST   /api/vouchers/:id/approve    DIRECTOR, { signatureId } → APPROVED
POST   /api/vouchers/:id/reject     DIRECTOR, { rejectionReason } → REJECTED

GET    /api/dashboard/stats         role-scoped statistics
GET    /api/health                  liveness, unauthenticated
```

`GET /api/vouchers` accepts `q` (matches voucher number, title, or employee name), `status`, `department`, `category`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`, `sortBy` (one of `voucherDate`, `expenseDate`, `amount`, `voucherNumber`, `status`, `createdAt`), `sortOrder`, `page`, and `pageSize` (capped at 100). `sortBy` is validated against that allow-list rather than passed through to Prisma, so an arbitrary column or relation cannot be ordered on. The response is `{ data, pagination: { page, pageSize, total, totalPages } }`.

`GET /api/dashboard/stats` returns a different payload per role, computed with aggregate queries rather than by counting in application code:

- Employee: total, draft, pending, approved and rejected counts, and total amount claimed, all scoped to the caller.
- Director: pending count, approved today, rejected today, total pending amount, and recent activity.
- Accounts: total, pending, approved and rejected counts, total approved amount, and recent approved vouchers.

"Today" is evaluated in the server's configured timezone, which the README names, because "Approved Today" is otherwise ambiguous.

## 7. Business rules and where they live

Each rule is enforced in the voucher service, inside a transaction where it reads and then writes:

1. Unique voucher number — database unique constraint plus the sequence.
2. Auto-generated number — `lib/voucherNumber.ts`, called on create.
3. New vouchers start as `DRAFT` — the create service ignores any client-supplied status.
4. Edit and delete only while `DRAFT` — guarded in update and delete; otherwise 409.
5. Submitted vouchers are read-only for employees — same guard.
6. Only the Director approves or rejects — `requireRole('DIRECTOR')` plus a status check that the voucher is `PENDING_APPROVAL`.
7. Approved vouchers are read-only — no transition out of `APPROVED` exists.
8. Rejection requires a reason — Zod requires a non-empty, trimmed string of at least 10 characters.
9. Employees see only their own — service-layer scoping.
10. The Director sees all — no scoping for that role.
11. Accounts sees all — no scoping for that role.
12. Submission requires the employee signature — submit returns 400 when `employeeSignatureId` is null.
13. Approval requires the Director signature — approve requires `signatureId` in the body and verifies the signature belongs to the calling Director.

Field validation, shared via Zod: department, title, expense date, and amount are mandatory; amount must be greater than zero and at most two decimal places; expense date may not be in the future; description is capped at 1000 characters. Uploads are capped at 2 MB and restricted to PNG, JPEG, and WebP, checked by both declared MIME type and magic bytes, since the extension and the declared type are both client-controlled. Stored filenames are generated UUIDs, never the client's filename.

## 8. Frontend

`AuthContext` calls `GET /api/auth/me` once on mount to restore the session from the cookie, and exposes `user`, `login`, `logout`, and a loading flag. It renders nothing route-dependent until that first call settles, so a refresh on a protected page does not flash the login screen.

`ProtectedRoute` takes the roles allowed for a route. An unauthenticated visitor is redirected to login; an authenticated user with the wrong role gets a "not authorized" screen rather than a redirect loop. The post-login landing route is chosen from the role.

Shared components: `VoucherForm` (create and edit, same Zod schema), `VoucherTable` (sortable headers, status badges), `VoucherFilters` (the search and filter panel, debounced, state mirrored into the query string so a filtered view is linkable), `SignatureUpload` (file picker, client-side type and size check, preview), `StatusBadge`, `StatCard`, `ApprovalDialog` and `RejectionDialog`, and `VoucherPrintView` (a print stylesheet, used by Accounts and available on the detail page).

Signature images are fetched from the authorized endpoint and rendered as object URLs, so the browser sends the cookie and the server still makes the access decision.

Layout is responsive: tables collapse into stacked cards below the `md` breakpoint, and the navigation becomes a drawer.

## 9. Error handling

The backend defines `AppError` with `statusCode` and `code`, and the subclasses `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, and `ConflictError`. Controllers throw; they never shape a response. `asyncHandler` forwards rejected promises to Express. The error middleware maps `AppError`, `ZodError`, Prisma's known request errors (notably `P2002` unique violation → 409 and `P2025` not found → 404), and Multer's errors; anything else is logged with its stack and returned as a generic 500 with no internal detail.

On the frontend, the API client throws a typed error carrying code and message. Forms show field-level messages from `details`; everything else surfaces as a toast. A 401 clears the auth context and redirects to login.

## 10. Testing

Backend tests run against a real Postgres database — the same engine as production, so sequence behaviour, decimal handling, and constraint violations are actually exercised. Each test file truncates the tables it touches and seeds its own fixtures.

The tests that carry the weight:

- **Authorization matrix.** Every role against every endpoint, asserting 200/403 per the table in section 5. This is one parameterized test, and it is the test most likely to catch a real regression.
- **Employee isolation.** Employee A cannot list, read, edit, delete, or submit Employee B's voucher; the detail route returns 404 rather than 403, so it does not confirm the id exists.
- **Transitions.** Every illegal transition returns 409: editing a submitted voucher, deleting an approved one, approving a draft, approving an already-approved voucher, rejecting an approved one.
- **Mandatory artifacts.** Submit without an employee signature is a 400; approve without a signature id is a 400; approve with another user's signature id is a 403; reject with a blank or too-short reason is a 400.
- **Voucher numbering.** Concurrent creates produce distinct numbers.
- **Validation.** Zero and negative amounts, a future expense date, a missing department or title, an over-size upload, and a disguised non-image file are all rejected.
- **Dashboard.** Each role's statistics are correct against a known fixture, and the employee figures exclude other employees' vouchers.

Frontend tests cover `VoucherForm` validation messages and `ProtectedRoute` redirect behaviour. No end-to-end suite: it would cost more than it returns at this scope.

Development follows the test-driven workflow — a failing test for each behaviour before the implementation.

## 11. Deliverables

- `README.md`: prerequisites, setup (docker-compose, migrate, seed, run), seeded credentials, environment variables, database schema explanation, full API documentation with request and response examples, and the assumptions list.
- `backend/.env.example` and `frontend/.env.example`, with no real secrets.
- Prisma migration files, committed.
- `prisma/seed.ts`: one user per role, plus sample vouchers spanning all four statuses so every dashboard and filter has data on first run.
- `docker-compose.yml` for Postgres.
- `.gitignore` covering `node_modules`, `.env`, and `backend/uploads/*`.

## 12. Assumptions

1. "Submitted" and "Pending Approval" are one status, as argued in section 4.
2. There is no self-service registration. Users come from the seed script, consistent with an assignment that specifies only a login screen and three fixed roles.
3. There is exactly one Director role, though the schema permits several users holding it. Any Director may act on any pending voucher.
4. A voucher carries a single amount, not line items; the assignment lists one Amount field.
5. Amounts are Indian Rupees. No currency field, no conversion.
6. An employee may upload a new signature per voucher and may reuse the most recent one; signatures are not shared between users.
7. A rejected voucher is terminal. The assignment defines no resubmission path, so the employee reads the reason and creates a new voucher.
8. Soft delete is not used. A draft delete is a hard delete, since a draft has no approval history worth keeping.
9. The expense date may not be in the future; a reimbursement claim is for money already spent.
10. Uploads live on local disk. Object storage would be the production choice and is a one-adapter change.
