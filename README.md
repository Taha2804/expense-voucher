# Expense Voucher Management System

A web application that replaces a manual expense reimbursement process. An employee raises an expense voucher and submits it for approval, the Director approves or rejects it with a signature, and the Accounts Team monitors approved vouchers for payment.

Built for the Prachay Securities Full Stack Developer Internship assignment.

---

## Contents

- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [Database schema](#database-schema)
- [Voucher workflow](#voucher-workflow)
- [API documentation](#api-documentation)
- [Running the tests](#running-the-tests)
- [Assumptions](#assumptions)
- [Project structure](#project-structure)

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js 22, Express 5, TypeScript |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Auth | JWT in an httpOnly cookie, bcrypt password hashing |
| Validation | Zod, shared rules on both sides |
| Uploads | Multer, local disk, magic-byte verified |
| Frontend | React 19, Vite, TypeScript, React Router 7 |
| Forms | React Hook Form + Zod resolver |
| Styling | Tailwind CSS 4 |
| Tests | Vitest + Supertest (backend), Vitest + Testing Library (frontend) |

---

## Prerequisites

- **Node.js 22 or later** (`node -v`)
- **Docker Desktop**, for the PostgreSQL container. If you would rather use an existing PostgreSQL 16 instance, skip step 1 and point `DATABASE_URL` at it; you will also need a second database named `voucher_test` if you intend to run the backend tests.

---

## Setup

Four commands from a clean clone.

### 1. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 16 on port 5432 and creates two databases: `voucher_db` for the application and `voucher_test` for the test suite. The suite truncates tables between files, which is why it never points at the development database.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

The API starts on **http://localhost:4000**. Check it with `curl http://localhost:4000/api/health`.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app starts on **http://localhost:5173**. The Vite dev server proxies `/api` to the backend, which keeps requests same-origin so the `SameSite=Strict` session cookie works without any extra configuration.

### 4. Sign in

Open http://localhost:5173 and use one of the demo accounts below.

---

## Demo accounts

All four share the password **`Password123!`**.

| Email | Role | Name |
|---|---|---|
| `employee@abc.com` | Employee | Aarav Sharma |
| `employee2@abc.com` | Employee | Sneha Iyer |
| `director@abc.com` | Director | Rohan Mehta |
| `accounts@abc.com` | Accounts Team | Priya Nair |

The second employee exists so the isolation rule is visible: sign in as Aarav and you will not see any of Sneha's vouchers, including by pasting one of her voucher URLs.

The seed creates vouchers in all four statuses, so every dashboard figure, every filter and both signature panels have data on the first run. Re-running `npm run prisma:seed` is safe — users are upserted by email and the voucher set is rebuilt.

---

## Environment variables

### `backend/.env`

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `test`, or `production`. Controls the cookie's `Secure` flag. |
| `PORT` | no | `4000` | Port the API listens on. |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string. |
| `JWT_SECRET` | **yes** | — | Signing key for the session token. Minimum 32 characters. Generate one with `openssl rand -base64 48`. |
| `JWT_EXPIRES_IN` | no | `8h` | Session lifetime. |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Origin allowed to send credentialed requests. |
| `UPLOAD_DIR` | no | `uploads/signatures` | Where signature images are written. |
| `MAX_UPLOAD_BYTES` | no | `2097152` | Maximum upload size (2 MB). |
| `TZ` | no | `Asia/Kolkata` | Timezone for every "today" calculation on the dashboards. |

The environment is parsed with Zod at import time, so a missing `DATABASE_URL` or a too-short `JWT_SECRET` fails the boot with a readable message instead of surfacing as a 500 on the first request that happens to need it.

### `frontend/.env`

Optional. `VITE_API_PROXY_TARGET` overrides where the dev server proxies `/api` (default `http://localhost:4000`).

### `backend/.env.test`

Optional. Without it the suite uses the `voucher_test` database created by `docker/init-test-db.sql`.

---

## Database schema

Three tables. The authoritative definition is [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma); the migrations that build it are in `backend/prisma/migrations/`.

### `User`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `email` | text, unique | Login identifier. |
| `passwordHash` | text | bcrypt, cost factor 12. |
| `name` | text | Printed on the voucher as "Employee Name". |
| `employeeCode` | text, null | "Employee ID". Optional per the requirements. |
| `department` | text, null | Pre-fills the voucher form. |
| `role` | enum | `EMPLOYEE` \| `DIRECTOR` \| `ACCOUNTS` |
| `createdAt`, `updatedAt` | timestamptz | |

Indexed on `role`.

### `Signature`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `ownerId` | uuid, FK → User | Who uploaded it. Cascades on user delete. |
| `filePath` | text | Filename inside `UPLOAD_DIR`. Always a generated UUID. |
| `mimeType` | text | `image/png`, `image/jpeg`, or `image/webp`. |
| `sizeBytes` | int | |
| `createdAt` | timestamptz | |

Indexed on `ownerId`.

### `Voucher`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `voucherNumber` | text, unique | `VCH-<year>-<6 digits>`, from a Postgres sequence. |
| `voucherDate` | date | When the voucher was raised. Defaults to the creation date. |
| `expenseDate` | date | When the money was spent. Mandatory, never in the future. |
| `department` | text | Mandatory. Copied from the user at creation, editable while a draft. |
| `title` | text | Mandatory. |
| `category` | enum | `TRAVEL`, `MEALS`, `ACCOMMODATION`, `OFFICE_SUPPLIES`, `CLIENT_ENTERTAINMENT`, `TRAINING`, `COMMUNICATION`, `OTHER` |
| `description` | text, null | Up to 1000 characters. |
| `amount` | `decimal(12,2)` | Mandatory, greater than zero. |
| `status` | enum | `DRAFT` \| `PENDING_APPROVAL` \| `APPROVED` \| `REJECTED` |
| `createdById` | uuid, FK → User | The employee who owns it. `onDelete: Restrict`. |
| `reviewedById` | uuid, FK → User, null | The Director who acted. |
| `employeeSignatureId` | uuid, FK → Signature, null | Required to leave `DRAFT`. |
| `directorSignatureId` | uuid, FK → Signature, null | Required to reach `APPROVED`. |
| `submittedAt` | timestamptz, null | When it left `DRAFT`. |
| `reviewedAt` | timestamptz, null | When the Director acted, approving **or** rejecting. |
| `approvalDate` | timestamptz, null | Set only on approval. |
| `rejectionReason` | text, null | Required to reach `REJECTED`. |
| `createdAt`, `updatedAt` | timestamptz | The audit fields. |

Indexed on `(createdById, status)` for the employee list and dashboard, and on `status`, `expenseDate`, `amount`, `department` and `reviewedAt` for the Director and Accounts filters.

### Three decisions worth explaining

**1. "Submitted" and "Pending Approval" are one status.** The brief's workflow diagram lists both, but nothing happens between them and no rule refers to one without the other. Submitting is the *action*; `PENDING_APPROVAL` is the resulting *status*; the UI labels it "Pending Approval".

**2. Voucher numbers come from a Postgres sequence, not a row count.** A dedicated `voucher_number_seq` is read with `nextval` inside the creation transaction. Deriving the number from `count() + 1` races under concurrent creation and would break the uniqueness rule the brief states first. There is a test that creates 25 concurrently and asserts 25 distinct numbers — a count-based implementation cannot pass it.

**3. A voucher references its signatures; it does not read them off the user.** If the signature lived on `User`, an employee replacing theirs would retroactively change the appearance of vouchers the Director had already approved. Referencing the signature row per voucher keeps approved records immutable.

**Money is `decimal`, never a float**, and is serialized to JSON as a **string** end to end. Totals are summed and displayed, and binary floating point produces visible rounding errors on exactly those values. No code path turns an amount into a JavaScript `number`; even the amount field in the form is a text input, because a number input would hand back `valueAsNumber`.

---

## Voucher workflow

```
            ┌─────────┐
            │  DRAFT  │  editable and deletable by its owner
            └────┬────┘
                 │  submit  (employee signature required)
                 ▼
        ┌──────────────────┐
        │ PENDING_APPROVAL │  read-only for the employee
        └───┬──────────┬───┘
   approve  │          │  reject  (reason required, min 10 chars)
 (director  │          │
 signature) ▼          ▼
     ┌──────────┐  ┌──────────┐
     │ APPROVED │  │ REJECTED │  employee reads the reason
     └────┬─────┘  └──────────┘
          │
          ▼
  visible to the Accounts Team for reimbursement
```

Both review transitions are terminal. Every transition is enforced server-side with the current status in the `WHERE` clause of a single conditional update, so two approvals racing each other produce exactly one 200 and one 409 — never a second write over the first reviewer's decision.

---

## API documentation

Base URL `http://localhost:4000`. Every response is JSON. Authentication is a `token` cookie, set at login — `httpOnly`, `SameSite=Strict`, `Secure` in production — so no `Authorization` header is needed and the token is never reachable from JavaScript.

### Error shape

Every failure returns the same envelope:

```json
{ "error": { "code": "CONFLICT", "message": "Only draft vouchers can be modified" } }
```

Validation failures add `details`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Amount must be greater than zero",
    "details": [{ "path": ["amount"], "message": "Amount must be greater than zero" }]
  }
}
```

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | A field is missing or malformed. |
| 401 | `UNAUTHORIZED` | No session, or an expired, forged, or orphaned token. |
| 403 | `FORBIDDEN` | The role does not permit the action, or the signature is not yours. |
| 404 | `NOT_FOUND` | Missing — or outside your scope. The two are deliberately indistinguishable. |
| 409 | `CONFLICT` | The voucher is not in a state that allows this transition. |
| 413 | `PAYLOAD_TOO_LARGE` | Upload over 2 MB. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Not a PNG, JPEG, or WebP — checked by magic bytes, not by the extension. |
| 500 | `INTERNAL_ERROR` | Unhandled. Logged with its stack; the message is never returned. |

### Permission table

| Action | Employee | Director | Accounts |
|---|:---:|:---:|:---:|
| Create voucher | ✅ | ❌ | ❌ |
| Edit / delete draft | own only | ❌ | ❌ |
| Submit | own only | ❌ | ❌ |
| List vouchers | own only | all | all |
| View detail | own only | all | all |
| Approve / reject | ❌ | ✅ | ❌ |
| Upload own signature | ✅ | ✅ | ❌ |
| View signature image | own, and those on own vouchers | all | all |

Scoping is applied in the service layer, as the last step of building the query, so no parameter a client sends can widen an employee's view.

---

### Authentication

#### `POST /api/auth/login`

```json
{ "email": "employee@abc.com", "password": "Password123!" }
```

**200** — sets the `token` cookie.

```json
{
  "user": {
    "id": "0f1c…", "email": "employee@abc.com", "name": "Aarav Sharma",
    "employeeCode": "EMP-001", "department": "Engineering", "role": "EMPLOYEE"
  }
}
```

**400** malformed body · **401** wrong password *or* unknown email — deliberately the same message, so the endpoint does not reveal which accounts exist.

#### `POST /api/auth/logout`

**200** `{ "success": true }`. Clears the cookie.

#### `GET /api/auth/me`

**200** `{ "user": { … } }` · **401** no session. The user is reloaded from the database on every request, so a token naming a deleted user is rejected.

---

### Signatures

#### `POST /api/signatures`

`multipart/form-data`, one file in the field **`image`**. Roles: Employee, Director.

**201**

```json
{ "signature": { "id": "9a2f…", "mimeType": "image/png", "sizeBytes": 792, "createdAt": "2026-10-12T02:17:04.000Z" } }
```

**400** no file · **403** Accounts · **413** over 2 MB · **415** not an image.

The first twelve bytes are checked against the PNG, JPEG and WebP signatures, because the declared MIME type and the extension are both client-controlled. A file that fails is deleted, so a rejected upload leaves nothing on disk. The stored filename is a generated UUID with the extension derived from the *verified* type — uploading `../../etc/passwd.png` cannot influence the path.

#### `GET /api/signatures/:id/image`

**200** the image bytes · **401** no session · **404** unknown, or not visible to you.

Served through an authorization check rather than a static mount, so holding the URL is not enough.

---

### Vouchers

#### `GET /api/vouchers`

Query parameters, all optional:

| Parameter | Notes |
|---|---|
| `q` | Matches voucher number, title, or employee name, case-insensitively. |
| `status` | One of the four statuses. |
| `department` | Exact, case-insensitive. |
| `category` | One of the eight categories. |
| `dateFrom`, `dateTo` | `YYYY-MM-DD`, inclusive, on `expenseDate`. 400 if `dateFrom` > `dateTo`. |
| `minAmount`, `maxAmount` | Inclusive, compared as decimals. 400 if min > max. |
| `sortBy` | `voucherDate` \| `expenseDate` \| `amount` \| `voucherNumber` \| `status` \| `createdAt`. Anything else is a 400. |
| `sortOrder` | `asc` \| `desc`. Default `desc`. |
| `page` | 1-based. Default 1. `0` or negative is a 400. |
| `pageSize` | Default 20, clamped to 100. Non-numeric is a 400. |

**200**

```json
{
  "data": [ { "id": "c420…", "voucherNumber": "VCH-2026-000025", "amount": "2450.75", "status": "APPROVED", "…": "…" } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 9, "totalPages": 1 }
}
```

Ordering always appends `id` as a secondary key, so a sort on a column with duplicate values is still a total order and paging through it cannot repeat or skip a row.

#### `POST /api/vouchers` — Employee

```json
{
  "expenseDate": "2026-10-09",
  "department": "Engineering",
  "title": "Airport taxi for the Mumbai review",
  "category": "TRAVEL",
  "description": "Return fare.",
  "amount": "2450.75",
  "employeeSignatureId": null
}
```

`department` falls back to your profile's department; `voucherDate` defaults to today; `category` defaults to `OTHER`.

**201** `{ "voucher": { … "status": "DRAFT", "voucherNumber": "VCH-2026-000025" } }`

A client-supplied `id`, `status` or `voucherNumber` is ignored: the insert is built field by field rather than spread from the body.

**400** validation · **403** Director or Accounts.

#### `GET /api/vouchers/:id`

**200** `{ "voucher": { … } }` · **404** unknown, or another employee's.

#### `PATCH /api/vouchers/:id` — Employee, own, `DRAFT` only

Any subset of the create fields. `voucherNumber`, `status`, `createdById` and every approval field are absent from the schema and are stripped before the service runs.

**200** · **400** validation · **403** wrong role, or a signature that is not yours · **404** not yours · **409** not a draft.

#### `DELETE /api/vouchers/:id` — Employee, own, `DRAFT` only

**204** · **404** not yours · **409** not a draft.

#### `POST /api/vouchers/:id/submit` — Employee, own, `DRAFT` only

No body. **200** with `status: "PENDING_APPROVAL"` and `submittedAt` set.

**400** no employee signature attached · **403** the attached signature is not yours · **409** already submitted.

#### `POST /api/vouchers/:id/approve` — Director

```json
{ "signatureId": "9a2f…" }
```

**200** with `status: "APPROVED"`, `approvalDate`, `reviewedAt`, `reviewedById` and `directorSignatureId` set.

**400** no `signatureId` · **403** not a Director, or the signature is not yours · **409** not awaiting approval.

#### `POST /api/vouchers/:id/reject` — Director

```json
{ "rejectionReason": "Outside the approved budget for this quarter." }
```

10–500 characters after trimming.

**200** with `status: "REJECTED"`, `rejectionReason`, `reviewedAt` and `reviewedById` set; `approvalDate` stays null.

**400** reason too short · **403** not a Director · **409** not awaiting approval.

---

### Dashboard

#### `GET /api/dashboard/stats`

Returns a different payload per role, computed with aggregate queries rather than by counting in application code.

**Employee**

```json
{ "stats": { "role": "EMPLOYEE", "total": 5, "draft": 2, "pending": 1, "approved": 1, "rejected": 1, "totalAmountClaimed": "49628.50" } }
```

**Director**

```json
{ "stats": { "role": "DIRECTOR", "pending": 1, "approvedToday": 1, "rejectedToday": 1, "totalPendingAmount": "4350.50", "recentActivity": [ … ] } }
```

**Accounts**

```json
{ "stats": { "role": "ACCOUNTS", "total": 9, "pending": 1, "approved": 3, "rejected": 3, "totalApprovedAmount": "30201.00", "recentApproved": [ … ] } }
```

"Today" is the local day in `TZ` (default `Asia/Kolkata`), not the UTC day. Measuring UTC would move the boundary by five and a half hours, so a voucher approved at 23:30 IST would be counted on the following day. There is a test for exactly that case.

#### `GET /api/health`

Unauthenticated. **200** `{ "status": "ok" }`.

---

## Running the tests

PostgreSQL must be running; the backend suite uses the real engine, so sequence behaviour, decimal handling and constraint violations are actually exercised rather than mocked.

```bash
cd backend && npm test      # 118 tests
cd frontend && npm test     #  19 tests
```

The backend suite is where the rules are pinned:

- **Authorization matrix** — every endpoint against employee, director, accounts and anonymous, asserting the permission class from the table above.
- **Employee isolation** — employee A cannot list, read, edit, delete or submit employee B's voucher, and the detail route answers 404 rather than 403.
- **Transitions** — every illegal transition returns 409, and an approved voucher cannot be moved anywhere.
- **Mandatory artifacts** — submit without a signature, approve without one, approve with someone else's, and reject with a blank or short reason are all rejected.
- **Concurrency** — 25 simultaneous creations produce 25 distinct voucher numbers; two simultaneous approvals produce one 200 and one 409.
- **Uploads** — ZIP bytes named `.png`, a zero-byte file, an oversized file and a text file are all rejected, and none of them leaves a file behind.
- **Amount precision** — `0`, `-1`, `0.001`, `1e5`, `abc` and an 11-digit value are rejected; `12.34` survives the JSON round trip as the string `"12.34"`.
- **Dashboard** — each role's figures against a known fixture, including the 23:30 IST boundary.

---

## Assumptions

1. **"Submitted" and "Pending Approval" are one status**, for the reason given above.
2. **There is no self-service registration.** Users come from the seed script, consistent with a brief that specifies a login screen and three fixed roles and never mentions sign-up.
3. **Any Director may act on any pending voucher.** The schema permits several users holding the role.
4. **A voucher carries a single amount, not line items** — the brief lists one Amount field.
5. **Amounts are Indian Rupees.** No currency field and no conversion.
6. **Signatures are per-user and per-voucher.** An employee may upload a new one for each voucher or reuse the last; signatures are never shared between users.
7. **A rejected voucher is terminal.** The brief defines no resubmission path, so the employee reads the reason and raises a new voucher.
8. **Draft deletion is a hard delete.** A draft has no approval history worth preserving.
9. **The expense date may not be in the future** — a reimbursement claim is for money already spent.
10. **Uploads live on local disk.** Object storage would be the production choice and is a one-adapter change behind `signatures.service.ts`.
11. **The Accounts Team cannot upload a signature**, because nothing in the workflow asks them to sign.
12. **The Director's "recent activity" excludes drafts** — a draft is not something the Director can see or act on.

---

## Project structure

```
.
├── docker-compose.yml           PostgreSQL 16 + the test database
├── docker/init-test-db.sql
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        the schema, with comments
│   │   ├── migrations/          three migrations
│   │   ├── seed.ts
│   │   └── seed-assets/         sample signature images
│   ├── src/
│   │   ├── config/env.ts        Zod-validated environment, fails fast
│   │   ├── lib/                 errors, prisma, money, voucher numbering
│   │   ├── middleware/          authenticate, requireRole, validate, upload, errorHandler
│   │   ├── modules/
│   │   │   ├── auth/            login, logout, me
│   │   │   ├── signatures/      upload, authorized image serving
│   │   │   ├── vouchers/        CRUD, filtering, workflow transitions
│   │   │   └── dashboard/       role-scoped statistics
│   │   ├── app.ts               builds the app; no listen, so tests can mount it
│   │   └── server.ts
│   └── tests/                   11 suites
└── frontend/
    └── src/
        ├── api/                 typed client, one module per resource
        ├── auth/                AuthContext, ProtectedRoute
        ├── components/          form, table, filters, dialogs, signature, layout
        ├── hooks/useVoucherList.ts
        ├── pages/               login, employee, director, accounts, shared detail
        └── schemas/voucher.ts   the form rules, mirroring the backend
```

Each module keeps its routes, controller, service and schemas together, so a change to one resource touches one directory. Controllers never shape an error response and never query; services hold the rules and the scoping; one middleware turns every error into the shared envelope.
