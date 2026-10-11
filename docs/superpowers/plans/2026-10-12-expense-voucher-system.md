# Expense Voucher Management System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a role-based web application in which employees create and submit expense vouchers, a Director approves or rejects them with a signature, and the Accounts Team monitors approved vouchers for reimbursement.

**Architecture:** A TypeScript monorepo with two independent packages. `backend/` is an Express 5 REST API over PostgreSQL via Prisma, with authentication by httpOnly JWT cookie, row-level scoping applied in the service layer, and signature images served through an authorization-checked route rather than a static mount. `frontend/` is a React 19 + Vite single-page app with role-aware protected routes, which talks to the API through a Vite dev proxy so requests stay same-origin.

**Tech Stack:** Node.js 22, Express 5, TypeScript 5, Prisma 6, PostgreSQL 16, Zod 3, bcrypt, jsonwebtoken, Multer 2, Vitest, Supertest, React 19, React Router 7, React Hook Form, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-10-12-expense-voucher-system-design.md`

## Global Constraints

- Node.js 22 or later. The backend and frontend each have their own `package.json`; there is no workspace root package.
- Backend listens on port `4000`; the Vite dev server on `5173` proxies `/api` to it.
- All money is `Decimal(12,2)` in the database and is serialized to JSON as a **string**. No code path converts an amount to a JavaScript `number`.
- Voucher status enum is exactly `DRAFT | PENDING_APPROVAL | APPROVED | REJECTED`. "Submitted" is an action, never a stored value.
- Voucher numbers have the form `VCH-<4-digit year>-<6-digit zero-padded sequence>`, e.g. `VCH-2026-000042`, drawn from the Postgres sequence `voucher_number_seq`.
- Expense category enum is exactly `TRAVEL | MEALS | ACCOMMODATION | OFFICE_SUPPLIES | CLIENT_ENTERTAINMENT | TRAINING | COMMUNICATION | OTHER`.
- Role enum is exactly `EMPLOYEE | DIRECTOR | ACCOUNTS`.
- Every error response is `{ "error": { "code": string, "message": string, "details"?: unknown } }`. No endpoint returns a bare string or an unwrapped object on failure.
- JWT lifetime 8 hours, cookie name `token`, `httpOnly`, `sameSite: 'strict'`, `secure` when `NODE_ENV === 'production'`, `path: '/'`.
- bcrypt cost factor 12.
- Signature uploads: max 2 MB, MIME allow-list `image/png`, `image/jpeg`, `image/webp`, verified by magic bytes as well as declared type. Stored filename is a generated UUID plus extension; the client filename is never used on disk.
- `pageSize` defaults to 20 and is capped at 100. `sortBy` is validated against an allow-list before reaching Prisma.
- Rejection reason: trimmed length at least 10 characters, at most 500.
- Server timezone for all "today" calculations is `Asia/Kolkata`, read from the `TZ` env var.
- Every task ends with a commit. Commit subjects use Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`, `fix:`).

## Review Focus

These are the input classes the spec implies but which no task's happy-path test would reach. Each has a test assigned to the task that owns the code.

1. **Pagination and sort parameters arriving hostile or absurd** — `page=0`, `page=-1`, `pageSize=5000`, `pageSize=abc`, `sortBy=password` must produce a 400 or a clamped query, never a crash and never ordering on an unintended column. Owned by Task 5.
2. **A second approval racing the first** — a Director double-clicking Approve must get 409 on the second request, with exactly one `approvalDate` written. Owned by Task 7.
3. **A non-image uploaded with an image extension and MIME type** — `evil.png` whose bytes are a ZIP, and a zero-byte file, must both be rejected 415 and must leave nothing on disk. Owned by Task 4.
4. **Amount precision at the boundary** — `0`, `-1`, `0.001`, `1e5`, `"12.345"`, and `99999999999.99` must be rejected or accepted exactly per the `Decimal(12,2)` and greater-than-zero rules, and an accepted amount must survive the round trip through JSON as the same string. Owned by Task 5.
5. **A date range inverted, and the "today" boundary** — `dateFrom` later than `dateTo` must 400 rather than silently return nothing, and a voucher approved at 23:30 `Asia/Kolkata` must count toward that day, not the next. Owned by Tasks 5 and 8.
6. **An expired or tampered session mid-use** — a request with an expired token, a token signed by a different secret, and a well-formed token naming a deleted user must each be 401, and the frontend must clear auth state and redirect to login rather than render an empty dashboard. Owned by Tasks 3 and 9.

---

## File Structure

**Backend** (`backend/`)

| File | Responsibility |
|---|---|
| `src/config/env.ts` | Parse and validate `process.env` with Zod; throw at boot on anything missing. |
| `src/lib/errors.ts` | `AppError` and its five subclasses. |
| `src/lib/asyncHandler.ts` | Wrap an async handler so rejections reach Express. |
| `src/lib/prisma.ts` | Single `PrismaClient` instance. |
| `src/lib/voucherNumber.ts` | Read the sequence, format the display number. |
| `src/lib/money.ts` | Decimal-safe parse and serialize helpers. |
| `src/middleware/errorHandler.ts` | Map every error class to the shared response shape. |
| `src/middleware/authenticate.ts` | Verify the cookie, load the user, attach to `req`. |
| `src/middleware/requireRole.ts` | Role gate, 403 on mismatch. |
| `src/middleware/validate.ts` | Zod validation of `body`, `query`, `params`. |
| `src/middleware/upload.ts` | Multer disk storage, limits, MIME filter. |
| `src/modules/auth/*` | Login, logout, current user. |
| `src/modules/signatures/*` | Upload and authorized image streaming. |
| `src/modules/vouchers/*` | CRUD, list querying, workflow transitions. |
| `src/modules/dashboard/*` | Role-scoped aggregate statistics. |
| `src/app.ts` | Build and return the Express app. No `listen`. |
| `src/server.ts` | Read config, call `listen`. |
| `prisma/schema.prisma` | The schema; doubles as schema documentation. |
| `prisma/seed.ts` | One user per role plus sample vouchers in all four statuses. |
| `tests/helpers/*` | Database truncation, fixture factories, authenticated agents. |

**Frontend** (`frontend/`)

| File | Responsibility |
|---|---|
| `src/api/client.ts` | `fetch` wrapper: `credentials: 'include'`, typed `ApiError`, 401 hook. |
| `src/api/{auth,vouchers,signatures,dashboard}.ts` | One typed function per endpoint. |
| `src/auth/AuthContext.tsx` | Session restore, login, logout, loading flag. |
| `src/auth/ProtectedRoute.tsx` | Authentication and role gate per route. |
| `src/schemas/voucher.ts` | The Zod schema shared by create and edit forms. |
| `src/components/*` | `VoucherForm`, `VoucherTable`, `VoucherFilters`, `SignatureUpload`, `StatusBadge`, `StatCard`, `ApprovalDialog`, `RejectionDialog`, `VoucherPrintView`, `AppLayout`. |
| `src/pages/*` | One directory per role, plus `shared/VoucherDetails`. |

---

## Task 1: Backend skeleton, config, errors, health

**Files:**
- Create: `docker-compose.yml`, `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`, `backend/.env.example`, `backend/src/config/env.ts`, `backend/src/lib/errors.ts`, `backend/src/lib/asyncHandler.ts`, `backend/src/middleware/errorHandler.ts`, `backend/src/app.ts`, `backend/src/server.ts`
- Test: `backend/tests/health.test.ts`, `backend/tests/errorHandler.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createApp(): express.Express` from `src/app.ts`
  - `env: { NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN, UPLOAD_DIR, MAX_UPLOAD_BYTES, TZ }` from `src/config/env.ts`
  - `class AppError extends Error { statusCode: number; code: string; details?: unknown }` and `ValidationError` (400, `VALIDATION_ERROR`), `UnauthorizedError` (401, `UNAUTHORIZED`), `ForbiddenError` (403, `FORBIDDEN`), `NotFoundError` (404, `NOT_FOUND`), `ConflictError` (409, `CONFLICT`) from `src/lib/errors.ts`
  - `asyncHandler<T extends RequestHandler>(fn: T): RequestHandler` from `src/lib/asyncHandler.ts`
  - `errorHandler(err, req, res, next): void` from `src/middleware/errorHandler.ts`

- [ ] **Step 1: Scaffold the package**

Create `backend/package.json` with dependencies `express@^5`, `@prisma/client`, `zod`, `bcrypt`, `jsonwebtoken`, `cookie-parser`, `cors`, `helmet`, `multer@^2`, and dev dependencies `typescript`, `tsx`, `prisma`, `vitest`, `supertest`, `@types/*` for express, node, bcrypt, jsonwebtoken, cookie-parser, cors, multer, supertest. Scripts: `dev` (`tsx watch src/server.ts`), `build` (`tsc`), `start` (`node dist/server.js`), `test` (`vitest run`), `test:watch`, `prisma:migrate`, `prisma:seed`, `prisma:studio`. `tsconfig.json` targets ES2022, `module: nodenext`, `strict: true`, `outDir: dist`, `rootDir: src`.

Create `docker-compose.yml` exposing `postgres:16-alpine` on `5432` with user `voucher`, password `voucher`, database `voucher_db`, and a named volume.

- [ ] **Step 2: Write the failing tests**

```ts
// tests/health.test.ts
it('GET /api/health returns 200 and { status: "ok" }')
it('GET /api/unknown returns 404 with error.code NOT_FOUND')

// tests/errorHandler.test.ts
// mount throwaway routes on a bare app wired with errorHandler
it('maps AppError subclasses to their status code and code', ...)
  // ForbiddenError -> 403 / FORBIDDEN, ConflictError -> 409 / CONFLICT
it('maps ZodError to 400 VALIDATION_ERROR with details array')
it('maps an unknown Error to 500 INTERNAL_ERROR and does not leak the message')
  // assert body.error.message !== 'secret internals leaked'
it('forwards a rejected async handler to the error middleware', ...)
  // route uses asyncHandler and rejects; expect 403, not a hung request
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `createApp` is not defined.

- [ ] **Step 4: Implement config, errors, `asyncHandler`, `errorHandler`, `createApp`**

`env.ts` parses with a Zod object schema and calls `process.exit(1)` after printing the issues when parsing fails, so a missing `JWT_SECRET` is a boot failure rather than a runtime 500. `JWT_SECRET` has a minimum length of 32 characters and no default. `createApp` wires, in order: `helmet()`, `cors({ origin: env.CORS_ORIGIN, credentials: true })`, `express.json()`, `cookieParser()`, the `/api/health` route, the module routers (none yet), a catch-all that throws `NotFoundError`, and `errorHandler` last. `errorHandler` logs `err.stack` for non-`AppError` errors and returns the generic message for them.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml backend/
git commit -m "feat(backend): add Express skeleton with validated config and error handling"
```

---

## Task 2: Prisma schema, migration, voucher number sequence, seed

**Files:**
- Create: `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`, `backend/src/lib/prisma.ts`, `backend/src/lib/voucherNumber.ts`, `backend/tests/helpers/db.ts`, `backend/tests/helpers/factories.ts`
- Test: `backend/tests/voucherNumber.test.ts`

**Interfaces:**
- Consumes: `env` (Task 1).
- Produces:
  - `prisma: PrismaClient` from `src/lib/prisma.ts`
  - `nextVoucherNumber(tx: Prisma.TransactionClient, now?: Date): Promise<string>` from `src/lib/voucherNumber.ts`
  - `resetDb(): Promise<void>`, `disconnectDb(): Promise<void>` from `tests/helpers/db.ts`
  - `createUser(overrides?: Partial<User> & { password?: string }): Promise<User>`, `createSignature(ownerId: string): Promise<Signature>`, `createVoucher(overrides: { createdById: string } & Partial<Voucher>): Promise<Voucher>` from `tests/helpers/factories.ts`

- [ ] **Step 1: Write the schema**

Write `schema.prisma` with the `User`, `Signature`, and `Voucher` models, the three enums, and the indexes exactly as given in spec section 4. Relations: `Voucher.createdBy`, `Voucher.reviewedBy`, `Voucher.employeeSignature`, `Voucher.directorSignature`, `Signature.owner`. `onDelete: Restrict` on `createdById` — a user with vouchers must not be deletable. Add doc comments on the three fields whose meaning is not obvious from the name (`voucherDate` versus `expenseDate`, `reviewedById`, `submittedAt`), since this file is the schema documentation the submission requires.

- [ ] **Step 2: Create the migration and the sequence**

Run `npx prisma migrate dev --name init`. Then create a second migration `npx prisma migrate dev --create-only --name voucher_number_sequence` and put in its SQL:

```sql
CREATE SEQUENCE voucher_number_seq START 1 INCREMENT 1;
```

Apply it. Both migration directories are committed.

- [ ] **Step 3: Write the failing test**

```ts
// tests/voucherNumber.test.ts
it('formats as VCH-<year>-<6 digits>', ...)
  // expect(await nextVoucherNumber(prisma, new Date('2026-03-01'))).toMatch(/^VCH-2026-\d{6}$/)
it('never returns the same number twice under concurrency', ...)
  // await Promise.all of 25 calls; expect new Set(results).size === 25
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npm test -- voucherNumber`
Expected: FAIL — `nextVoucherNumber` is not defined.

- [ ] **Step 5: Implement `nextVoucherNumber`**

Read the sequence with `tx.$queryRaw<{ nextval: bigint }[]>` on `SELECT nextval('voucher_number_seq')`, then format with the year from `now` and the value zero-padded to six digits. The sequence, not a `count()`, is what makes the concurrency test pass.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npm test -- voucherNumber`
Expected: PASS, 2 tests.

- [ ] **Step 7: Write the test helpers and the seed**

`resetDb` truncates `Voucher`, `Signature`, `User` with `TRUNCATE ... RESTART IDENTITY CASCADE` and resets `voucher_number_seq`. Factories take overrides and fill the rest with valid defaults; `createUser` hashes `password ?? 'Password123!'`. `seed.ts` is idempotent — it upserts by email — and creates `employee@abc.com`, `director@abc.com`, `accounts@abc.com` (all password `Password123!`), a second employee to prove isolation, and at least two vouchers in each of the four statuses with signature rows pointing at two small committed sample PNGs in `prisma/seed-assets/`.

- [ ] **Step 8: Verify the seed runs twice cleanly**

Run: `cd backend && npm run prisma:seed && npm run prisma:seed`
Expected: both runs exit 0; no unique-constraint error on the second.

- [ ] **Step 9: Commit**

```bash
git add backend/prisma backend/src/lib backend/tests
git commit -m "feat(backend): add Prisma schema, voucher number sequence, and seed data"
```

---

## Task 3: Authentication and authorization middleware

**Files:**
- Create: `backend/src/modules/auth/{auth.schemas.ts,auth.service.ts,auth.controller.ts,auth.routes.ts}`, `backend/src/middleware/{authenticate.ts,requireRole.ts,validate.ts}`, `backend/src/types/express.d.ts`, `backend/tests/helpers/agent.ts`
- Modify: `backend/src/app.ts` — mount `/api/auth`
- Test: `backend/tests/auth.test.ts`

**Interfaces:**
- Consumes: `createApp`, `AppError` subclasses (Task 1); `prisma`, `createUser` (Task 2).
- Produces:
  - `authenticate: RequestHandler` — sets `req.user: { id, email, name, role, department }`
  - `requireRole(...roles: Role[]): RequestHandler`
  - `validate(schemas: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }): RequestHandler` — writes the parsed value back over `req.body` / `req.query` / `req.params`, so handlers read coerced types
  - `login(email: string, password: string): Promise<{ user: PublicUser; token: string }>` from `auth.service.ts`
  - `loginAs(app, email, password?): Promise<supertest.SuperAgentTest>` from `tests/helpers/agent.ts` — returns an agent holding the cookie
  - `type PublicUser = { id, email, name, employeeCode, department, role }` — never includes `passwordHash`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/auth.test.ts
it('POST /api/auth/login with valid credentials returns 200, the user, and sets an httpOnly token cookie')
  // assert set-cookie contains HttpOnly and SameSite=Strict
  // assert body.user.passwordHash === undefined
it('POST /api/auth/login with a wrong password returns 401 UNAUTHORIZED')
it('POST /api/auth/login with an unknown email returns 401 UNAUTHORIZED')
  // assert the message is identical to the wrong-password message
it('POST /api/auth/login with a malformed body returns 400 VALIDATION_ERROR')
it('GET /api/auth/me without a cookie returns 401')
it('GET /api/auth/me with the login cookie returns the current user')
it('GET /api/auth/me with an expired token returns 401')
it('GET /api/auth/me with a token signed by a different secret returns 401')
it('GET /api/auth/me with a valid token for a deleted user returns 401')
it('POST /api/auth/logout clears the cookie and a subsequent /me returns 401')
it('requireRole returns 403 for a wrong-role user and 200 for an allowed one')
  // mount a probe route guarded by requireRole('DIRECTOR')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- auth`
Expected: FAIL — 404 on `/api/auth/login`.

- [ ] **Step 3: Implement the auth module and the three middlewares**

`login` looks up the user, compares with `bcrypt.compare`, and throws `UnauthorizedError('Invalid email or password')` for both the unknown-email and wrong-password cases — the same message, so the endpoint does not enumerate accounts. Run the bcrypt comparison against a fixed dummy hash when the user is absent, so the two paths take comparable time. The controller sets the cookie and returns only `PublicUser`. `authenticate` reads `req.cookies.token`, verifies it, then loads the user from the database — the token being valid is not enough, because the user may have been removed. `express.d.ts` augments `Express.Request` with the optional `user`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- auth`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests
git commit -m "feat(backend): add cookie-based JWT auth with role and validation middleware"
```

---

## Task 4: Signature upload and authorized image serving

**Files:**
- Create: `backend/src/middleware/upload.ts`, `backend/src/modules/signatures/{signatures.service.ts,signatures.controller.ts,signatures.routes.ts}`, `backend/uploads/signatures/.gitkeep`
- Modify: `backend/src/app.ts` — mount `/api/signatures`
- Test: `backend/tests/signatures.test.ts`, `backend/tests/fixtures/{valid.png,not-an-image.png,empty.png,oversize.png}`

**Interfaces:**
- Consumes: `authenticate`, `requireRole` (Task 3); `prisma`, `createUser`, `createVoucher`, `createSignature` (Task 2).
- Produces:
  - `uploadSignature: RequestHandler` — Multer single-file middleware on field `image`
  - `createSignatureRecord(ownerId: string, file: Express.Multer.File): Promise<Signature>`
  - `canViewSignature(viewer: PublicUser, signatureId: string): Promise<boolean>`
  - `getSignatureFile(viewer: PublicUser, signatureId: string): Promise<{ absolutePath: string; mimeType: string }>` — throws `NotFoundError` when not viewable

- [ ] **Step 1: Write the failing tests**

```ts
// tests/signatures.test.ts
it('POST /api/signatures as an employee returns 201 with the signature id and persists the file')
it('POST /api/signatures as ACCOUNTS returns 403')
it('POST /api/signatures with no file returns 400 VALIDATION_ERROR')
it('POST /api/signatures with a 3 MB file returns 413')
it('POST /api/signatures with text/plain returns 415')
it('POST /api/signatures with ZIP bytes named .png and typed image/png returns 415')
  // Review Focus 3
it('POST /api/signatures with a zero-byte .png returns 415')
  // Review Focus 3
it('a rejected upload leaves no file in UPLOAD_DIR')
  // Review Focus 3: read the directory before and after; counts must match
it('stores the file under a UUID name, not the client filename')
  // upload "../../etc/passwd.png"; assert no path traversal and the name matches a UUID pattern
it('GET /api/signatures/:id/image returns the bytes to the owner')
it('GET /api/signatures/:id/image returns 404 to an unrelated employee')
it('GET /api/signatures/:id/image returns 200 to a DIRECTOR and to ACCOUNTS')
it('GET /api/signatures/:id/image returns 200 to an employee when it is attached to their own voucher')
it('GET /api/signatures/:id/image without a cookie returns 401')
it('GET /api/signatures/:id/image for an unknown id returns 404')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- signatures`
Expected: FAIL — 404 on `/api/signatures`.

- [ ] **Step 3: Implement the upload middleware and the module**

Multer uses `diskStorage` with `filename` returning `${randomUUID()}${extFromMime}` — derive the extension from the verified MIME type, never from the client's filename. `limits.fileSize` is `env.MAX_UPLOAD_BYTES`. `fileFilter` checks the declared MIME against the allow-list. After Multer writes the file, the controller reads the first 12 bytes and checks the magic number (`89 50 4E 47` for PNG, `FF D8 FF` for JPEG, `52 49 46 46` plus `57 45 42 50` at offset 8 for WebP); on mismatch or on a zero-byte file it unlinks the file and throws a 415. The `errorHandler` gains a branch mapping Multer's `LIMIT_FILE_SIZE` to 413.

`canViewSignature` returns true when `signature.ownerId === viewer.id`, when the viewer's role is `DIRECTOR` or `ACCOUNTS`, or when a voucher exists with `createdById = viewer.id` and this signature in either signature column. `getSignatureFile` throws `NotFoundError` rather than `ForbiddenError`, so the endpoint does not confirm that an id exists.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- signatures`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests backend/uploads
git commit -m "feat(backend): add signature upload with magic-byte validation and authorized serving"
```

---

## Task 5: Voucher create, read, and list

**Files:**
- Create: `backend/src/modules/vouchers/{vouchers.schemas.ts,vouchers.service.ts,vouchers.controller.ts,vouchers.routes.ts}`, `backend/src/lib/money.ts`
- Modify: `backend/src/app.ts` — mount `/api/vouchers`
- Test: `backend/tests/vouchers.create.test.ts`, `backend/tests/vouchers.list.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces:
  - `createVoucherSchema`, `updateVoucherSchema`, `listVouchersQuerySchema` from `vouchers.schemas.ts`
  - `type ListVouchersQuery = z.infer<typeof listVouchersQuerySchema>`
  - `createVoucher(user: PublicUser, input: CreateVoucherInput): Promise<VoucherDto>`
  - `getVoucherById(user: PublicUser, id: string): Promise<VoucherDto>` — throws `NotFoundError` when outside the viewer's scope
  - `listVouchers(user: PublicUser, query: ListVouchersQuery): Promise<{ data: VoucherDto[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>`
  - `type VoucherDto` — every voucher column, `amount` as a string, plus `createdBy: { id, name, employeeCode }`, `reviewedBy: { id, name } | null`, `employeeSignatureId`, `directorSignatureId`
  - `serializeAmount(d: Prisma.Decimal): string`, `parseAmount(s: string): Prisma.Decimal` from `money.ts`

- [ ] **Step 1: Write the failing create tests**

```ts
// tests/vouchers.create.test.ts
it('POST /api/vouchers as an employee returns 201 with status DRAFT and a VCH- number')
it('ignores a client-supplied status and id', ...)
  // post { status: 'APPROVED' }; expect body.status === 'DRAFT'
it('defaults voucherDate to today and department to the user department')
it('returns 403 for DIRECTOR and for ACCOUNTS')
it('returns 400 when department, title, expenseDate, or amount is missing', ...)
  // table-driven over the four fields; assert error.details names the field
it('rejects amount 0, -1, "0.001", "1e5", "abc", and 99999999999.99')
  // Review Focus 4
it('accepts amount "12.34" and returns it as the string "12.34"')
  // Review Focus 4: round trip, not a number
it('rejects an expenseDate in the future')
it('rejects a description longer than 1000 characters')
it('rejects an unknown category')
```

- [ ] **Step 2: Write the failing list tests**

```ts
// tests/vouchers.list.test.ts
it('an EMPLOYEE sees only their own vouchers')
it('an EMPLOYEE cannot widen the scope by sending createdById or userId in the query')
it('a DIRECTOR and an ACCOUNTS user see all vouchers')
it('GET /api/vouchers/:id returns 404 for another employee\'s voucher')
  // 404, not 403 — it must not confirm the id exists
it('filters by status, department, category')
it('filters by q against voucher number, title, and employee name')
it('filters by dateFrom/dateTo on expenseDate, inclusive on both ends')
it('filters by minAmount/maxAmount, inclusive, comparing as decimals not strings')
  // "9" must not be treated as greater than "10"
it('sorts by each allowed sortBy, ascending and descending')
it('paginates: page 2 of pageSize 2 returns the third and fourth rows and total stays the full count')
it('returns 400 for page=0, page=-1, pageSize=abc, and sortBy=passwordHash')
  // Review Focus 1
it('clamps pageSize=5000 to 100')
  // Review Focus 1
it('returns 400 when dateFrom is later than dateTo')
  // Review Focus 4 (date half)
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && npm test -- vouchers`
Expected: FAIL — 404 on `/api/vouchers`.

- [ ] **Step 4: Implement the schemas, service, controller, and routes**

`listVouchersQuerySchema` uses `z.coerce` for the numeric and date fields, `.int().min(1)` for `page`, `.int().min(1).max(100)` with `.default(20)` for `pageSize` — `max` rather than a transform for `pageSize=abc` and `page=0`, and a `.transform(v => Math.min(v, 100))` so `5000` clamps rather than 400s; `sortBy` is a `z.enum` of the six allowed columns; a `.superRefine` raises the inverted-range and inverted-amount-range errors. `amount` is `z.string()` matched against `/^\d{1,10}(\.\d{1,2})?$/` and then checked greater than zero, which rejects `1e5` and `0.001` by shape rather than by numeric coercion.

`createVoucher` runs in `prisma.$transaction`: call `nextVoucherNumber(tx)`, then create with `status: 'DRAFT'`, `createdById: user.id`, and only the whitelisted input fields — build the `data` object field by field rather than spreading the request, so an injected `status` cannot reach the database.

`listVouchers` builds the `where` clause from the query, then, when `user.role === 'EMPLOYEE'`, assigns `where.createdById = user.id` as the **last** step so no client input can override it. `q` becomes an `OR` over `voucherNumber`, `title`, and `createdBy.name`, each `contains` with `mode: 'insensitive'`. The count and the page are fetched in one `$transaction`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npm test -- vouchers`
Expected: PASS, 24 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src backend/tests
git commit -m "feat(backend): add voucher creation, detail, and filtered list with role scoping"
```

---

## Task 6: Draft editing, deletion, and submission

**Files:**
- Modify: `backend/src/modules/vouchers/{vouchers.service.ts,vouchers.controller.ts,vouchers.routes.ts}`
- Test: `backend/tests/vouchers.draft.test.ts`

**Interfaces:**
- Consumes: Task 5's service and schemas.
- Produces:
  - `updateVoucher(user: PublicUser, id: string, input: UpdateVoucherInput): Promise<VoucherDto>`
  - `deleteVoucher(user: PublicUser, id: string): Promise<void>`
  - `submitVoucher(user: PublicUser, id: string): Promise<VoucherDto>`
  - `assertOwnedDraft(user: PublicUser, id: string, tx): Promise<Voucher>` — the shared guard; `NotFoundError` when not the owner's, `ConflictError` when not `DRAFT`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/vouchers.draft.test.ts
it('PATCH updates a DRAFT voucher owned by the caller')
it('PATCH cannot change voucherNumber, status, createdById, or any approval field')
it('PATCH on a PENDING_APPROVAL, APPROVED, or REJECTED voucher returns 409')
  // table-driven over the three statuses
it('PATCH on another employee\'s draft returns 404')
it('PATCH as DIRECTOR returns 403')
  // the Director must not be able to edit employee data
it('DELETE removes a DRAFT owned by the caller and returns 204')
it('DELETE on a non-DRAFT voucher returns 409')
it('DELETE on another employee\'s draft returns 404')
it('POST :id/submit with an employee signature moves DRAFT to PENDING_APPROVAL and sets submittedAt')
it('POST :id/submit without employeeSignatureId returns 400 and leaves the status DRAFT')
it('POST :id/submit twice returns 409 on the second call')
it('POST :id/submit with a signature owned by another user returns 403')
it('PATCH can attach an employeeSignatureId the caller owns and rejects one they do not')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- vouchers.draft`
Expected: FAIL — 404 on PATCH.

- [ ] **Step 3: Implement the three operations**

All three take the row inside a transaction through `assertOwnedDraft`, which loads the voucher, throws `NotFoundError` when it is missing or `createdById !== user.id`, and throws `ConflictError('Only draft vouchers can be modified')` when the status is not `DRAFT`. `updateVoucherSchema` is the create schema made partial, minus every field the test forbids — the forbidden fields are absent from the schema, so they are stripped before the service sees them. `submitVoucher` additionally requires `employeeSignatureId` to be non-null and to belong to the caller, then writes `status: 'PENDING_APPROVAL'` and `submittedAt: new Date()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- vouchers.draft`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests
git commit -m "feat(backend): add draft editing, deletion, and submission with status guards"
```

---

## Task 7: Approval and rejection

**Files:**
- Modify: `backend/src/modules/vouchers/{vouchers.schemas.ts,vouchers.service.ts,vouchers.controller.ts,vouchers.routes.ts}`
- Test: `backend/tests/vouchers.review.test.ts`, `backend/tests/authorization-matrix.test.ts`

**Interfaces:**
- Consumes: Tasks 5 and 6.
- Produces:
  - `approveVoucher(director: PublicUser, id: string, signatureId: string): Promise<VoucherDto>`
  - `rejectVoucher(director: PublicUser, id: string, rejectionReason: string): Promise<VoucherDto>`

- [ ] **Step 1: Write the failing review tests**

```ts
// tests/vouchers.review.test.ts
it('POST :id/approve as DIRECTOR with their own signature sets APPROVED, approvalDate, reviewedById, directorSignatureId')
it('POST :id/approve without signatureId returns 400')
it('POST :id/approve with a signature owned by someone else returns 403')
it('POST :id/approve on a DRAFT voucher returns 409')
it('POST :id/approve on an already APPROVED or REJECTED voucher returns 409')
it('POST :id/approve as EMPLOYEE or ACCOUNTS returns 403')
it('two concurrent approvals: exactly one 200 and one 409, and approvalDate is written once')
  // Review Focus 2: Promise.allSettled of two requests; assert statuses.sort() === [200, 409]
it('POST :id/reject with a reason sets REJECTED, rejectionReason, reviewedById, approvalDate stays null')
it('POST :id/reject with a blank, whitespace-only, or 9-character reason returns 400')
it('POST :id/reject on a DRAFT or APPROVED voucher returns 409')
it('POST :id/reject does not require a director signature')
it('an approved voucher cannot be transitioned anywhere: submit, approve, reject, patch, delete all fail')
  // business rule 7, read-only after approval
it('the employee who created a rejected voucher can read the rejection reason')
```

- [ ] **Step 2: Write the failing authorization matrix test**

```ts
// tests/authorization-matrix.test.ts
// one parameterized test over { method, path, role } x expected status
// rows cover every endpoint from spec section 6 against EMPLOYEE, DIRECTOR,
// ACCOUNTS, and no-cookie, asserting the status class from the spec section 5
// permission table (2xx vs 401 vs 403)
it.each(matrix)('$method $path as $role -> $expected', ...)
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && npm test -- vouchers.review authorization-matrix`
Expected: FAIL — 404 on approve.

- [ ] **Step 4: Implement approve and reject**

Both run inside `prisma.$transaction`. Load the voucher with `SELECT ... FOR UPDATE` via `tx.$queryRaw` — or equivalently use a conditional `updateMany` with `where: { id, status: 'PENDING_APPROVAL' }` and treat a `count` of 0 as `ConflictError`. The conditional update is what makes the concurrency test deterministic; a read-then-write without the status in the `where` clause lets both requests through. Approve verifies the signature belongs to the calling Director before writing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS, full backend suite.

- [ ] **Step 6: Commit**

```bash
git add backend/src backend/tests
git commit -m "feat(backend): add approval and rejection with conflict-safe transitions"
```

---

## Task 8: Dashboard statistics

**Files:**
- Create: `backend/src/modules/dashboard/{dashboard.service.ts,dashboard.controller.ts,dashboard.routes.ts}`
- Modify: `backend/src/app.ts` — mount `/api/dashboard`
- Test: `backend/tests/dashboard.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 5.
- Produces:
  - `getStats(user: PublicUser): Promise<EmployeeStats | DirectorStats | AccountsStats>`
  - `type EmployeeStats = { role: 'EMPLOYEE'; total, draft, pending, approved, rejected: number; totalAmountClaimed: string }`
  - `type DirectorStats = { role: 'DIRECTOR'; pending: number; approvedToday: number; rejectedToday: number; totalPendingAmount: string; recentActivity: VoucherDto[] }`
  - `type AccountsStats = { role: 'ACCOUNTS'; total, pending, approved, rejected: number; totalApprovedAmount: string; recentApproved: VoucherDto[] }`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/dashboard.test.ts
// fixture: employee A with 1 draft / 2 pending / 3 approved / 1 rejected,
// employee B with 5 approved, known amounts
it('employee stats count only the caller\'s vouchers and sum only their amounts')
it('employee totalAmountClaimed is a string and sums with decimal precision', ...)
  // amounts 0.10, 0.20 -> "0.30", never "0.30000000000000004"
it('director stats report the pending count and total pending amount across all employees')
it('director approvedToday counts a voucher approved at 23:30 Asia/Kolkata on that day and excludes one from the previous day')
  // Review Focus 4 (today half)
it('director rejectedToday behaves the same way')
it('director recentActivity returns the 10 most recently updated vouchers, newest first')
it('accounts stats report org-wide counts and totalApprovedAmount over APPROVED only')
it('accounts recentApproved returns only APPROVED vouchers, newest approvalDate first')
it('returns 401 without a cookie')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- dashboard`
Expected: FAIL — 404 on `/api/dashboard/stats`.

- [ ] **Step 3: Implement `getStats`**

Branch on role and build each payload from `prisma.voucher.groupBy({ by: ['status'], _count: true, _sum: { amount: true } })` plus the two `count` calls for today — one aggregate round trip per dashboard, not a count per status. Compute the day boundary by converting "now" to `Asia/Kolkata`, taking the local midnight, and converting back to UTC for the query; do not compare against `new Date().toISOString().slice(0, 10)`, which is UTC and would move the boundary by five and a half hours. Decimal sums come back as `Prisma.Decimal` and go through `serializeAmount`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- dashboard`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests
git commit -m "feat(backend): add role-scoped dashboard statistics"
```

---

## Task 9: Frontend shell, API client, auth context, protected routes, login

**Files:**
- Create: `frontend/` via Vite, then `frontend/.env.example`, `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/src/api/client.ts`, `frontend/src/api/auth.ts`, `frontend/src/auth/AuthContext.tsx`, `frontend/src/auth/ProtectedRoute.tsx`, `frontend/src/pages/login/LoginPage.tsx`, `frontend/src/components/AppLayout.tsx`, `frontend/src/types/index.ts`, `frontend/src/App.tsx`, `frontend/src/main.tsx`
- Test: `frontend/src/auth/ProtectedRoute.test.tsx`, `frontend/src/api/client.test.ts`

**Interfaces:**
- Consumes: the backend's `/api/auth/*` contract (Task 3).
- Produces:
  - `api: { get<T>(path, params?): Promise<T>; post<T>(path, body?): Promise<T>; patch<T>; del(path): Promise<void>; postForm<T>(path, form: FormData): Promise<T> }` from `api/client.ts`
  - `class ApiError extends Error { status: number; code: string; details?: unknown }`
  - `useAuth(): { user: User | null; loading: boolean; login(email, password): Promise<User>; logout(): Promise<void> }`
  - `<ProtectedRoute roles={Role[]}>` — renders an `<Outlet />`
  - `homeRouteForRole(role: Role): string` — `/employee`, `/director`, `/accounts`
  - `type User`, `type Role`, `type VoucherStatus`, `type ExpenseCategory`, `type Voucher`, `type Paginated<T>` in `types/index.ts`, mirroring the backend DTOs with `amount: string`
  - `type ListQuery = { q?, status?, department?, category?, dateFrom?, dateTo?, minAmount?, maxAmount?, sortBy?, sortOrder?, page?, pageSize? }` — all optional strings or numbers, mirroring the backend's `listVouchersQuerySchema` input

- [ ] **Step 1: Scaffold and configure**

`npm create vite@latest frontend -- --template react-ts`, then add `react-router-dom`, `react-hook-form`, `zod`, `@hookform/resolvers`, `tailwindcss`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. `vite.config.ts` proxies `/api` to `http://localhost:4000` with `changeOrigin: true`, which is what keeps the `SameSite=Strict` cookie working in development.

- [ ] **Step 2: Write the failing tests**

```ts
// src/api/client.test.ts
it('throws ApiError carrying status, code, and message from the error envelope')
it('sends credentials: include on every request')
it('calls the registered onUnauthorized handler exactly once on a 401')
  // Review Focus 5
it('serializes params, dropping undefined and empty-string values')

// src/auth/ProtectedRoute.test.tsx
it('renders nothing while loading rather than redirecting')
  // a refresh on a protected page must not flash the login screen
it('redirects an unauthenticated user to /login')
it('renders the outlet for an allowed role')
it('renders the not-authorized screen, not a redirect, for a disallowed role')
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the client, context, route guard, layout, and login page**

`client.ts` wraps `fetch` with `credentials: 'include'`, parses the error envelope into `ApiError`, and exposes `setUnauthorizedHandler` which `AuthContext` registers so a 401 anywhere clears `user` and navigates to `/login`. `AuthContext` calls `GET /api/auth/me` once on mount and holds `loading: true` until it settles. `LoginPage` uses React Hook Form with a Zod resolver, shows the server's message on a 401, disables the submit button while in flight, and redirects to `homeRouteForRole`. `AppLayout` renders the role-appropriate navigation, the user's name and role, and a logout button, collapsing the navigation into a drawer below `md`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): add app shell, API client, auth context, and protected routes"
```

---

## Task 10: Shared voucher components

**Files:**
- Create: `frontend/src/schemas/voucher.ts`, `frontend/src/api/{vouchers.ts,signatures.ts,dashboard.ts}`, `frontend/src/components/{VoucherForm.tsx,VoucherTable.tsx,VoucherFilters.tsx,SignatureUpload.tsx,StatusBadge.tsx,StatCard.tsx,ApprovalDialog.tsx,RejectionDialog.tsx,SignatureImage.tsx}`, `frontend/src/lib/format.ts`
- Test: `frontend/src/components/VoucherForm.test.tsx`, `frontend/src/components/VoucherFilters.test.tsx`

**Interfaces:**
- Consumes: Task 9's `api`, types, and `useAuth`.
- Produces:
  - `voucherFormSchema` — the same rules as the backend's create schema: department, title, expenseDate, amount required; amount matching `/^\d{1,10}(\.\d{1,2})?$/` and greater than zero; expenseDate not in the future; description at most 1000 characters
  - `<VoucherForm mode="create" | "edit" initial?={Voucher} onSaved={(v: Voucher) => void} />`
  - `<VoucherTable rows={Voucher[]} sortBy sortOrder onSortChange showEmployee?={boolean} onRowClick />`
  - `<VoucherFilters value={ListQuery} onChange={(q: ListQuery) => void} />` — debounced 300 ms, mirrored into the query string
  - `<SignatureUpload value={string | null} onChange={(signatureId: string) => void} />`
  - `<SignatureImage signatureId={string} />` — fetches the authorized endpoint as a blob and renders an object URL
  - `<StatusBadge status={VoucherStatus} />`, `<StatCard label value hint? />`
  - `formatAmount(s: string): string` — `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` over the string, never over a float
  - `formatDate(iso: string): string`

- [ ] **Step 1: Write the failing tests**

```tsx
// VoucherForm.test.tsx
it('shows a required-field message for each of department, title, expenseDate, amount')
it('rejects amount 0 and -5 with "Amount must be greater than zero"')
it('rejects an amount with three decimal places')
it('rejects a future expense date')
it('does not call the API when validation fails')
it('in edit mode, pre-fills every field from the initial voucher')
it('disables submit while the request is in flight')

// VoucherFilters.test.tsx
it('debounces the search input to one onChange after 300 ms')
it('clears a filter back to undefined rather than an empty string')
it('writes the active filters into the query string')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- VoucherForm VoucherFilters`
Expected: FAIL — components not found.

- [ ] **Step 3: Implement the components**

`VoucherForm` keeps `amount` as a string in form state all the way to the API — binding it to a `number` input and reading `valueAsNumber` would reintroduce the float. The form offers "Save as Draft" and "Save and Submit"; the second calls create or update and then `POST :id/submit`, and surfaces the backend's 400 when the signature is missing. `SignatureUpload` checks type and size client-side before uploading, shows a preview, and reports the resulting signature id upward; the client-side check is a convenience and the backend remains the authority. `VoucherTable` renders one row per voucher on `md` and above and a stacked card below it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- VoucherForm VoucherFilters`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add shared voucher form, table, filters, and signature components"
```

---

## Task 11: Employee pages

**Files:**
- Create: `frontend/src/pages/employee/{EmployeeDashboard.tsx,CreateVoucherPage.tsx,MyVouchersPage.tsx,EditVoucherPage.tsx}`, `frontend/src/pages/shared/VoucherDetailsPage.tsx`
- Modify: `frontend/src/App.tsx` — register the employee routes
- Test: manual verification against the seeded database

**Interfaces:**
- Consumes: Tasks 9 and 10.
- Produces: routes `/employee`, `/employee/vouchers/new`, `/employee/vouchers`, `/employee/vouchers/:id`, `/employee/vouchers/:id/edit`, all wrapped in `<ProtectedRoute roles={['EMPLOYEE']}>`.

- [ ] **Step 1: Build the dashboard**

Six `StatCard`s from `GET /api/dashboard/stats` — total, draft, pending, approved, rejected, and total amount claimed — above a table of the five most recent vouchers.

- [ ] **Step 2: Build create, list, edit, and detail**

`MyVouchersPage` composes `VoucherFilters` and `VoucherTable` over `GET /api/vouchers`. `EditVoucherPage` loads the voucher and redirects to the detail page with an explanatory message when the status is not `DRAFT`, so a stale link cannot present an editable form for a submitted voucher. `VoucherDetailsPage` is shared by all three roles: it renders every field from spec section 5, both signatures through `SignatureImage`, the rejection reason when present, and the audit timestamps, and it shows action buttons based on `useAuth().user.role` and the voucher status — Edit, Delete, and Submit for the owning employee's draft, Approve and Reject for a Director on a pending voucher, Print for everyone.

- [ ] **Step 3: Verify the full employee flow against the running app**

Start Postgres, the backend, and the frontend. Log in as `employee@abc.com`, then: create a draft, confirm it appears with a `VCH-` number, edit it, upload a signature, submit it, confirm the status reads Pending Approval and the Edit and Delete buttons are gone, and confirm a second employee's voucher id typed into the URL renders a not-found state.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add employee dashboard, voucher creation, list, edit, and detail"
```

---

## Task 12: Director pages

**Files:**
- Create: `frontend/src/pages/director/{DirectorDashboard.tsx,PendingApprovalsPage.tsx,AllVouchersPage.tsx}`
- Modify: `frontend/src/App.tsx` — register the director routes
- Test: manual verification against the seeded database

**Interfaces:**
- Consumes: Tasks 9, 10, 11 (`VoucherDetailsPage`).
- Produces: routes `/director`, `/director/pending`, `/director/vouchers`, `/director/vouchers/:id`, wrapped in `<ProtectedRoute roles={['DIRECTOR']}>`.

- [ ] **Step 1: Build the dashboard**

Pending count, approved today, rejected today, and total pending amount as `StatCard`s, with the recent-activity table beneath.

- [ ] **Step 2: Build pending approvals and all vouchers**

`PendingApprovalsPage` is the list pinned to `status=PENDING_APPROVAL`. `AllVouchersPage` exposes the full filter set. Both link into the shared detail page.

- [ ] **Step 3: Wire approval and rejection**

`ApprovalDialog` requires a signature — it reuses the Director's most recent signature or takes a new upload — and disables Confirm until one is present. `RejectionDialog` requires at least 10 characters and shows the remaining-character count. After either, refetch the voucher so the screen shows the new status rather than an optimistic guess. A 409 from a voucher someone else already reviewed surfaces as "This voucher has already been reviewed" and refetches.

- [ ] **Step 4: Verify the full director flow**

Log in as `director@abc.com`: approve a pending voucher with a signature, reject another with a reason, confirm neither can be acted on twice, confirm no form on the detail page lets you alter employee-entered fields, and confirm the dashboard's approved-today and rejected-today counts moved by one each.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add director dashboard, pending approvals, and review actions"
```

---

## Task 13: Accounts pages and the print view

**Files:**
- Create: `frontend/src/pages/accounts/{AccountsDashboard.tsx,AllVouchersPage.tsx}`, `frontend/src/components/VoucherPrintView.tsx`, `frontend/src/styles/print.css`
- Modify: `frontend/src/App.tsx` — register the accounts routes; `frontend/src/pages/shared/VoucherDetailsPage.tsx` — add the Print action
- Test: manual verification against the seeded database

**Interfaces:**
- Consumes: Tasks 9, 10, 11.
- Produces: routes `/accounts`, `/accounts/vouchers`, `/accounts/vouchers/:id`, wrapped in `<ProtectedRoute roles={['ACCOUNTS']}>`.

- [ ] **Step 1: Build the dashboard and list**

Total, pending, approved, and rejected counts, total approved expense amount, and a recent-approved table. The list page defaults its status filter to `APPROVED`, since reimbursement processing is the role's job, and the filter can be cleared.

- [ ] **Step 2: Build the print view**

`VoucherPrintView` lays the voucher out as a single page with both signature images, the approval date, and the voucher number, and `print.css` hides the navigation and the action buttons under `@media print`. Print is triggered with `window.print()` from the detail page.

- [ ] **Step 3: Verify the accounts flow**

Log in as `accounts@abc.com`: confirm all vouchers across employees are visible, confirm no Create, Edit, Delete, Approve, or Reject control is rendered anywhere, confirm both signatures display on an approved voucher, and confirm the print preview shows one clean page.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add accounts dashboard, voucher list, and print view"
```

---

## Task 14: Documentation and submission readiness

**Files:**
- Create: `README.md`
- Modify: `backend/.env.example`, `frontend/.env.example`, `.gitignore`
- Test: a clean-clone walkthrough

- [ ] **Step 1: Write the README**

Sections, in order: overview; tech stack; prerequisites; setup (clone, `docker compose up -d`, backend `npm install` / `npx prisma migrate deploy` / `npm run prisma:seed` / `npm run dev`, frontend `npm install` / `npm run dev`); the three seeded logins with their password; environment variables in a table with the meaning of each; **database schema** — the three tables, every column, the enums, the indexes, and why each of the three pinned decisions was made; **API documentation** — every endpoint with method, path, required role, request body, a sample success response, and the error codes it can return; the voucher workflow as a diagram; **assumptions** — all ten from spec section 12; and how to run the tests.

- [ ] **Step 2: Confirm the environment examples are complete and clean**

Every variable `env.ts` requires appears in `backend/.env.example` with a placeholder value and no real secret. `JWT_SECRET` carries a comment saying to generate one with `openssl rand -base64 48`.

- [ ] **Step 3: Verify from a clean clone**

Clone the repository to a scratch directory, follow the README verbatim, and confirm the application runs and all three logins work. Fix whatever the README left out.

- [ ] **Step 4: Run the full suite**

Run: `cd backend && npm test` then `cd frontend && npm test`
Expected: both PASS with no skipped tests.

- [ ] **Step 5: Commit**

```bash
git add README.md backend/.env.example frontend/.env.example .gitignore
git commit -m "docs: add README with setup, schema, API documentation, and assumptions"
```
