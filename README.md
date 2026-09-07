# Field Service Management System — Backend

REST API for a field-service marketplace: customers submit service requests (plumbing, electrical, HVAC, etc.), technicians apply, get approved, set their availability, and get assigned to jobs; customers pay through bKash once work is done, and leave feedback afterward. Admins review requests, assign technicians, manage users, and see dashboard stats.

**Stack:** Node.js · Express 5 · TypeScript · Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL · Redis · JWT auth · Zod validation · Cloudinary (file storage) · Nodemailer + EJS (emails) · Google OAuth · bKash (payments) · PDFKit (invoices) · Biome (lint/format) · tsup (build)

## Prerequisites

| Tool | Notes |
|---|---|
| **Node.js** | LTS recommended (no `engines` field is set in `package.json`) |
| **PostgreSQL** | Any recent version — connected through `@prisma/adapter-pg` |
| **Redis** | Used for OTPs, pending-registration payloads, and cached bKash tokens — the server won't start without it |
| **Cloudinary account** | Profile images, service-request attachments, and completion photos are uploaded here |
| **Gmail account (or SMTP creds usable via Nodemailer's `gmail` service)** | Sends OTP, welcome, service-request, and invoice emails |
| **bKash sandbox/merchant credentials** | Needed for the payment module to function |
| **Google OAuth client ID/secret** | Only needed if you use `/api/v1/auth/google` |

Any package manager works; examples below use `npm`.

---

## Getting started

**1. Install dependencies**
```bash
npm install
```

**2. Set up your environment file**
```bash
cp .env.example .env
```
The `DATABASE_URL` shipped in `.env.example` (`postgres://fsmpublic?sslmode=public`) is a **placeholder, not a working connection string** — replace it with a real one:
```
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/fsm?schema=public"
```
See [Environment variables](#environment-variables) for everything else you need to fill in.

**3. Generate the Prisma client**
```bash
npm run db:generate
```
Prisma writes a typed client into `src/generated/prisma`. It's git-ignored, and nearly everything under `src/` imports from it — skip this and nothing compiles.

**4. Run the migrations**
```bash
npm run db:migrate
```
Applies the SQL already committed under `prisma/migrations/` (currently 4 migrations, latest from Sept 2026), creating tables for users, technician profiles/skills/availability, service categories, service requests, payments, feedback, and audit logs.

**5. Seed an admin account and starter categories (optional but recommended)**
```bash
npm run db:seed
```
Runs `src/seed.ts`, which creates one `ADMIN` user (skipped if an admin already exists) and four starter `ServiceCategory` rows — Plumbing, Electrical, HVAC, Appliance Repair (skipped individually if already present). The admin's credentials default to `admin@fsm.com` / `Admin123!` / `System Admin` unless you set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` in the environment first.

**6. Start the server**
```bash
npm run dev
```
On success you'll see, in order:
```
Connected to the database successfully.
Redis connected successfully!
Nodemailer connected successfully.
Server is running on port 5000
```
All three connections (`prisma.$connect()`, `redisClient.connect()`, `transporter.verify()`) are awaited at startup — if Redis or your SMTP credentials aren't reachable, the server logs the error and exits instead of starting in a half-working state.

Confirm it's up:
```bash
curl http://localhost:5000/
# {"success":true,"message":"Welcome to Field Service Management System Backend"}
```

---

## Environment variables

`src/app/config/index.ts` is the only place `process.env` is read; application code imports the exported `config` object.

| Variable | What it's for |
|---|---|
| `NODE_ENV` | `development` includes stack traces/raw errors in API error responses |
| `PORT` | HTTP server port |
| `DATABASE_URL` | Postgres connection string (used by Prisma via `@prisma/adapter-pg`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing keys for access/refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes (e.g. `1d`, `7d`) |
| `BCRYPT_SALT_ROUNDS` | Actually used — passed to `bcrypt.hash()` on register and password reset |
| `BACKEND_URL` | Used to build the bKash `callbackURL` for payment redirects |
| `FRONTEND_URL` | CORS allowlist origin, and used to build email/redirect links back to the frontend |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth — only `GOOGLE_CLIENT_ID` is actually read in code |
| `REDIS_USER` / `REDIS_PASSWORD` / `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `SMTP_USER` / `SMTP_PASSWORD` | Gmail credentials for Nodemailer |
| `EMAIL_SENDER` | "From" address on outgoing emails |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary credentials for profile images, attachments, and completion photos |
| `BKASH_SANDBOX_URL` / `BKASH_USERNAME` / `BKASH_PASSWORD` / `BKASH_APP_KEY` / `BKASH_APP_SECRET` | bKash tokenized-checkout credentials, all blank in `.env.example` — fill in your sandbox/merchant values |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Optional, read directly by `src/seed.ts` (not through `config`) to customize the seeded admin |

There's no startup validation of these — most are read with a `!` (non-null assertion) in `config/index.ts`, so a missing variable becomes `undefined` at runtime rather than a clear boot-time error, and fails wherever it's first used (e.g. the very first Cloudinary upload, or the very first bKash token request).

---

## Project structure

```
src/
├── server.ts                        # connects Prisma, Redis, Nodemailer, then starts listening
├── app.ts                           # express app: cors, body/cookie parsing, route mounting, error handling
├── seed.ts                          # seeds one ADMIN user + 4 starter service categories
├── generated/prisma/                # Prisma client — git-ignored, run `npm run db:generate`
├── validations/index.ts             # shared QuerySchema (search/pagination/sort) and idValidationSchema
└── app/
    ├── config/index.ts              # reads and exposes every environment variable
    ├── lib/
    │   ├── prisma.ts                 # shared PrismaClient (via PrismaPg adapter)
    │   ├── redis.ts                  # Redis client
    │   ├── cloudinary.ts             # Cloudinary v2 config
    │   ├── multer.ts                 # in-memory storage for file uploads
    │   ├── nodemailer.ts             # Gmail transporter
    │   ├── googleAuth.ts             # Google OAuth2Client
    │   └── bkash.ts                  # bKash id_token grant/refresh, cached in Redis
    ├── middleware/
    │   ├── checkAuth.ts              # `auth(...roles)` — the JWT + role + DB-freshness guard
    │   ├── optionalAuth.ts           # same token parsing as auth(), but never blocks the request
    │   ├── validateRequest.ts        # Zod-validates req.body (also unwraps multipart `data` JSON field)
    │   ├── validateQuery.ts          # Zod-validates req.query into req.validatedQuery
    │   ├── globalErrorHandler.ts     # maps Prisma/Zod/AppError/generic errors to real status codes
    │   └── notFound.ts               # catch-all for unmatched routes
    ├── utils/
    │   ├── AppError.ts               # typed error with statusCode + optional details
    │   ├── catchAsync.ts             # wraps async handlers so thrown errors reach the error handler
    │   ├── jwt.ts                    # sign / verify helpers
    │   ├── sendResponse.ts           # standard `{ success, statusCode, message, data, meta? }` envelope
    │   ├── redisActions.ts           # shared OTP/token get-set-delete-ttl helper, keyed by prefix
    │   └── renderOtpEmail.ts         # renders the shared OTP email template for either purpose
    ├── templates/                    # EJS email templates
    │   ├── otp.ejs
    │   ├── welcome-to-the-FSM.ejs
    │   ├── service-request-received.ejs
    │   └── reset-password-success.ejs
    └── module/
        ├── auth/                     # register (OTP), verify-otp, login, google, refresh, forgot/reset password
        ├── users/                    # get/update own profile
        ├── technicians/              # apply, admin approval, skills, public technician listing/feedback
        ├── categories/                # admin CRUD + public listing of service categories
        ├── availability/              # technician availability windows (date + period slots)
        ├── serviceRequest/            # the full request lifecycle + feedback
        ├── payment/                   # bKash checkout, callback, refund, invoicing
        └── admin/                     # dashboard stats, audit logs, user block/role management

prisma/
├── schema/                           # split across multiple files, wired by prisma.config.ts
│   ├── schema.prisma                  # generator + datasource only
│   ├── enums.prisma
│   ├── user.prisma
│   ├── technicianProfile.prisma
│   ├── technicianSkill.prisma
│   ├── technicianAvailability.prisma
│   ├── serviceCategory.prisma
│   ├── serviceRequest.prisma
│   ├── payment.prisma
│   ├── feedback.prisma
│   └── auditLog.prisma
└── migrations/                       # 4 migrations committed, latest Sept 2026
```

`prisma.config.ts` at the repo root wires the split schema files together and loads `.env` so the Prisma CLI can see `DATABASE_URL`.

---

## Data model

- **`User`** — `role` is `CUSTOMER` (default) / `TECHNICIAN` / `ADMIN`, `authProvider` is `CREDENTIAL` or `GOOGLE`. Soft-deletable (`isDeleted`/`deletedAt`), plus a separate `isBlocked` flag.
- **`TechnicianProfile`** — 1-to-1 with a `User`. Created when a customer applies via `/technicians/apply`. Has its own `applicationStatus`: `PENDING` → `APPROVED`/`REJECTED` (admin-controlled).
- **`TechnicianSkill`** — join table between a technician profile and a `ServiceCategory`.
- **`TechnicianAvailability`** — a technician's bookable slots, `date` + `period` (`MORNING`/`AFTERNOON`/`EVENING`), status `OPEN`/`BOOKED`/`BLOCKED`. A `@@unique([technicianProfileId, date, period])` constraint, combined with a DB transaction on the `OPEN → BOOKED` transition, is the actual double-booking guard — not application-level locking.
- **`ServiceCategory`** — e.g. Plumbing, Electrical. Soft-deletable.
- **`ServiceRequest`** — the core entity. Links a customer, category, optional technician, optional assigning admin, and optional availability window. Its `status` enum has **nine** values: `PENDING → REVIEWED → ASSIGNED → IN_PROGRESS → COMPLETED → INVOICED → PAID → CLOSED`, plus `CANCELLED` at any point before `COMPLETED`. In practice, the code path never sets `INVOICED` — payment can be initiated as soon as a request is `COMPLETED`, and a successful bKash callback moves it straight to `PAID`.
- **`Payment`** — 1-to-1 with a `ServiceRequest`. Tracks the full bKash lifecycle (`paymentID`, `trxID`, gateway responses, refund fields). `PaymentStatus` is `PENDING`/`PAID`/`FAILED`/`REFUNDED` — there's no `CANCELLED` value, so a cancelled bKash checkout is recorded as `FAILED` (see `payment.service.ts`).
- **`Feedback`** — 1-to-1 with a `ServiceRequest`, left by the customer. Only allowed once the request is `PAID` or `CLOSED`; submitting feedback moves the request to `CLOSED`.
- **`AuditLog`** — append-only record of status changes, assignments, payment updates, role changes, and account actions, each tied to an actor and (optionally) a service request.

---

## The API

Base URL: `http://localhost:5000`. Every JSON response has the shape `{ success, statusCode, message, data, meta? }` (from `sendResponse`), except the root health check and `notFound`.

### Auth — `/api/v1/auth`
| Method | Path | Notes |
|---|---|---|
| `POST` | `/register` | `multipart/form-data`, optional `profileImage` file. Doesn't create the user yet — sends an OTP and stashes the registration payload in Redis for 5 minutes. |
| `POST` | `/verify-otp` | Confirms the OTP, actually creates the `User`, sets `accessToken`/`refreshToken` cookies, sends a welcome email, returns the tokens in the body too. |
| `POST` | `/login` | Sets cookies + returns tokens in the body. |
| `POST` | `/google` | Verifies a Google ID token; links to an existing credential account by email or creates a new `CUSTOMER`. |
| `POST` | `/refresh-token` | Reads the `refreshToken` cookie, issues a new pair. |
| `POST` | `/forgot-password` | Emails an OTP (5 min TTL) — only works for `CREDENTIAL`-provider accounts. |
| `POST` | `/reset-password` | Verifies the OTP and updates the password. |

**Cookie caveat:** `verify-otp` sets cookies with `sameSite: "lax"`, but `login`, `google`, and `refresh-token` set them with `sameSite: "none"` + `secure: false` — an invalid combination that modern browsers silently drop. Use the `accessToken`/`refreshToken` values from the **response body** for those three routes, e.g.:
```bash
curl http://localhost:5000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken from the response body>"
```
`Authorization` accepts either `Bearer <token>` or the raw token.

### Users — `/api/v1/users`
| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/me` | any role | |
| `PATCH` | `/me` | any role | `multipart/form-data`, optional `profileImage`. Technician-only fields (`bio`, `yearsOfExperience`, `serviceArea`) are only applied when the caller's role is `TECHNICIAN`. |

### Technicians — `/api/v1/technicians`
| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/apply` | `CUSTOMER` | Creates the `TechnicianProfile` (with initial availability + skills) in one nested Prisma call. Fails if one already exists. |
| `PATCH` | `/:userId/update-application-status` | `ADMIN` | Approve/reject an application. |
| `GET` | `/` | `ADMIN` | List all technicians. |
| `GET` | `/public` | – | Public technician listing. |
| `GET` | `/public/:technicianId` | – | Public technician detail. |
| `GET` | `/:technicianId/feedback` | – | Public feedback for a technician. |
| `POST` / `GET` / `DELETE` | `/me/skills[/:categoryId]` | `TECHNICIAN` | Manage own skills. |

### Categories — `/api/v1/categories`
`POST` / `PATCH /:categoryId` / `DELETE /:categoryId` are `ADMIN`-only (delete is a soft delete). `GET /` is public but uses `optionalAuth`, so it can behave differently for a logged-in caller without ever blocking one.

### Service requests — `/api/v1/service-requests`
| Method | Path | Auth | Effect on `status` |
|---|---|---|---|
| `POST` | `/` | `CUSTOMER` | multipart, up to 5 `requestAttachments` → creates at `PENDING`, emails the customer |
| `GET` | `/me` | `CUSTOMER` | own requests |
| `GET` | `/` | `ADMIN` | search/filter/paginate all requests |
| `PATCH` | `/:id/review` | `ADMIN` | `PENDING → REVIEWED` |
| `PATCH` | `/:id/assign` | `ADMIN` | `REVIEWED → ASSIGNED`; books the technician's availability slot in the same transaction |
| `GET` | `/assigned-to-me` | `TECHNICIAN` | own assigned jobs |
| `PATCH` | `/:id/start` | `TECHNICIAN` | `ASSIGNED → IN_PROGRESS` |
| `PATCH` | `/:id/complete` | `TECHNICIAN` | multipart, up to 5 `completionPhotos` → `IN_PROGRESS → COMPLETED`, sets `finalAmount` |
| `PATCH` | `/:id/cancel` | `CUSTOMER` or `ADMIN` | customers can only cancel while `PENDING`/`REVIEWED`; admins can also cancel `ASSIGNED`/`IN_PROGRESS`. Releases the availability slot if one was booked. |
| `GET` | `/:id` | owning customer, assigned technician, or `ADMIN` | full detail |
| `POST` / `GET` | `/:id/feedback` | as above (post: `CUSTOMER` only) | feedback only accepted for `PAID`/`CLOSED` requests; posting moves it to `CLOSED` |

### Availability — `/api/v1/availability`
`POST /` and `GET /me` (`TECHNICIAN`) manage own slots; `PATCH /:id/block` and `DELETE /:id` only work on `OPEN` slots. `GET /technician/:technicianProfileId` is public (via `optionalAuth`) and returns only `OPEN` windows. `GET /` (`ADMIN`) lists everything with filters.

### Payments — `/api/v1/payments`
| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/initiate` | `CUSTOMER` | Only for a `COMPLETED` request with a `finalAmount` set. Gets a bKash `id_token` (cached in Redis, auto-refreshed), creates a bKash checkout, stores a `Payment` row, returns `bkashURL` to redirect the customer to. |
| `POST` | `/re-initiate` | `CUSTOMER` | Same flow, reusing the existing `Payment` row — only if its status is `PENDING`/`FAILED`. |
| `GET` | `/callback` | – | The bKash redirect target. Handles `failure`/`cancel`/`success` outcomes; on `success` it re-confirms with bKash's `execute` endpoint (never trusts the redirect alone), then in one transaction marks the payment `PAID`, the request `PAID`, and writes an audit log — then generates a PDF invoice with PDFKit and emails it. A failed invoice email doesn't roll back the already-confirmed payment. |
| `POST` | `/:paymentId/refund` | `ADMIN` | Only for a `PAID` payment; calls bKash's refund endpoint and updates the record + audit log. |
| `GET` | `/me` | `CUSTOMER` | own payment history, paginated |
| `GET` | `/` | `ADMIN` | all payments, filterable |
| `GET` | `/:paymentId` | owning customer, assigned technician, or `ADMIN` | |

### Admin — `/api/v1/admin`
`GET /dashboard-stats` (service-request counts by status, total paid revenue, technician applications by status — every enum value included even at zero), `GET /audit-logs` (filterable), `PATCH /users/:userId/block`, `PATCH /users/:userId/role` (a manual override that bypasses the technician-application flow entirely — logged as such in the audit trail).

---

## Roles and authentication

Three roles: `CUSTOMER` (default on registration and Google sign-in), `TECHNICIAN`, `ADMIN`. There's no public way to register directly as `TECHNICIAN` or `ADMIN` — you become a technician by applying and getting approved, or an admin can force a role change via `/admin/users/:userId/role` (this bypasses the approval flow and is flagged as such in the audit log).

`auth(...roles)` (`checkAuth.ts`) is the route guard. For each protected route it, in order:
1. Reads the token from the `accessToken` cookie, falling back to the `Authorization` header.
2. Verifies the JWT signature.
3. Checks the role **from the token payload** against the roles the route allows.
4. Re-fetches the user from the database matching `id`, `email`, `name`, **and** `role` all at once — if any of the four has changed since the token was issued, the lookup fails and the request is rejected even though the account still exists.
5. Rejects if the user is soft-deleted, blocked, or has an unverified email.
6. Attaches `req.user` (including `technicianProfileId` for technicians).

`optionalAuth` runs the same token parsing but never blocks the request — it just leaves `req.user` unset on any failure, which several public-but-personalizable routes (category listing, technician availability) rely on.

---

## Error handling

`globalErrorHandler` maps errors to real HTTP status codes (not a blanket 500): Prisma validation/known-request/initialization errors, Zod validation errors (with a per-field `errorDetails` array), and `AppError` all get their appropriate status. Anything else falls back to `500`. In `development`, the response includes the error name, message, raw error, and stack trace; in any other `NODE_ENV`, all of that collapses to a generic `"Internal Server Error"`.

`AppError` is a typed `Error` subclass carrying a `statusCode` and optional `details`. Route handlers are wrapped in `catchAsync` so any thrown error (including a bare `new Error(...)`, which several auth/service functions still use instead of `AppError`) reaches the handler instead of crashing the process.

---

## Scripts

```bash
npm run dev          # tsx watch src/server.ts — auto-reload while developing
npm run build         # tsup → bundles src/server.ts to dist/ (ESM, with a require() shim for CJS deps)
npm run start         # node dist/server.js — run the built output
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev
npm run db:seed       # prisma db seed → runs src/seed.ts
npm test              # placeholder — not wired up
```

`npm run build` output is directly runnable with `node`, unlike a plain `tsc` build — `tsup` bundles everything into a single ESM file and injects a `createRequire` shim, which is what lets `npm run start` (and the `vercel.json` config, which points straight at `dist/server.js`) work without `tsx`.

---

## Known gaps

- **`INVOICED` status is unreachable.** It exists in the `ServiceRequestStatus` enum but no code path sets it — `COMPLETED` requests go straight to payment, and a successful payment sets the request to `PAID` directly.
- **No `CANCELLED` payment status.** A cancelled bKash checkout is recorded as `FAILED` in the `Payment` row (see the comment in `payment.service.ts`).
- **No environment validation at startup** — most config values are read with a non-null assertion (`!`), so a missing variable surfaces as a runtime error at first use, not a clear boot-time failure.
- **No automated tests.** `npm test` is a placeholder.
- **Soft-delete fields exist on most models** (`isDeleted`/`deletedAt`) but only `ServiceCategory` deletion actually sets them — there's no delete endpoint for users, service requests, or technician profiles.
