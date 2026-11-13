# Placement Bridge — Engineering Bug Log & Architecture Guide

This document records all bugs identified, root-cause analyses, code fixes applied, retest results, and architectural explanations designed to help understand and explain the full stack during project evaluations and viva voce examinations.

---

## 1. Defect & Bug Resolution Ledger

### BUG-01: Neon PostgreSQL Connection String Space & Parsing Failure
- **Bug ID:** `BUG-01`
- **Error Message:** `PrismaClientInitializationError: Error parsing connection string: Invalid URL` / `Server configuration error: DATABASE_URL is not a valid PostgreSQL connection URI.`
- **Reproduction Steps:** Set `DATABASE_URL=" postgresql://..."` with a leading space inside `.env`.
- **Root Cause:** In `.env`, an accidental leading whitespace after the assignment operator caused URL parsing routines in `new URL()` to fail.
- **Files Affected:** [`.env`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/.env), [`src/db/prisma.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/db/prisma.ts)
- **Fix Applied:** Removed whitespace; enforced `.trim()` and URL parameter validation in `buildNormalizedDatasourceUrl()`.
- **Retest Result:** **PASS** — Connection string parses cleanly into Prisma Client.

---

### BUG-02: PgBouncer Prepared Statement Collisions & Channel Binding Drop
- **Bug ID:** `BUG-02`
- **Error Message:** `Can't reach database server at ep-soft-shadow-b44blnis-pooler.c-6.us-east-2.aws.neon.tech:5432` / `prepared statement does not exist`
- **Reproduction Steps:** Connect directly to the pooled Neon endpoint (`-pooler`) without `pgbouncer=true` and with `channel_binding=require`.
- **Root Cause:** Neon's pooled endpoint uses PgBouncer in transaction pooling mode. PgBouncer does not retain prepared statements across transaction boundaries and drops connections when incompatible SCRAM channel binding options are forced.
- **Files Affected:** [`.env`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/.env), [`src/db/prisma.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/db/prisma.ts)
- **Fix Applied:** Removed `channel_binding=require`; appended `pgbouncer=true&connect_timeout=30`; added automatic normalization in `prisma.ts` to ensure `pgbouncer=true` is always active on `-pooler` hosts.
- **Retest Result:** **PASS** — Queries execute without connection drops or prepared statement errors.

---

### BUG-03: Connection Pool Exhaustion on Seed and Profile Recalculation
- **Bug ID:** `BUG-03`
- **Error Message:** `HTTP 500: DATABASE_ERROR` during student registration (`AUTH-01 & AUTH-02`) / timeout in `ensureSeededOnce()`.
- **Reproduction Steps:** Register two students in succession or execute batch seed operations.
- **Root Cause:** Neon's Free-Tier serverless pool has strict client concurrency limits. In `recalculateAndPersistProfileCompletion()` (`src/db/users.ts`), an 8-way `Promise.all` count query fired simultaneously for every registration, overwhelming PgBouncer slots and causing HTTP 500. Similarly, batch upserts in `seed.ts` opened dozens of parallel transactions.
- **Files Affected:** [`src/db/users.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/db/users.ts), [`src/db/seed.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/db/seed.ts), [`src/db/prisma.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/db/prisma.ts)
- **Fix Applied:**
  1. Converted the 8-query `Promise.all` in `recalculateAndPersistProfileCompletion` to sequential async queries.
  2. Throttled `runInChunks` in `seed.ts` to chunks of 2 with 50ms inter-chunk delay.
  3. Replaced badge `Promise.all` upserts with a sequential `for...of` loop.
  4. Configured `connection_limit=3` in `src/db/prisma.ts` for Neon free-tier safety.
- **Retest Result:** **PASS** — `AUTH-01 & AUTH-02` passed; full seed completed with 11 users, 16 companies, 140 questions, 8 badges.

---

### BUG-04: Neon Cold-Start Compute Inactivity Sleep Failures
- **Bug ID:** `BUG-04`
- **Error Message:** `Can't reach database server at ep-soft-shadow-...neon.tech:5432` after inactivity.
- **Reproduction Steps:** Run tests or make an API request after the database has been idle for >5 minutes.
- **Root Cause:** Neon Free Tier pauses compute endpoints when idle to conserve cloud resources. The first query wake-up takes 2–8 seconds, which exceeded standard 2-second connection timeouts.
- **Files Affected:** [`src/db/seed.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/db/seed.ts), [`tests/integration/api.test.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/tests/integration/api.test.ts)
- **Fix Applied:**
  1. Added a 5-attempt retry loop with exponential backoff (2s, 4s, 6s, 8s, 10s) in `ensureSeededOnce()`.
  2. Increased test `beforeAll` timeout to 120,000ms.
- **Retest Result:** **PASS** — Database wakes reliably and all subsequent tests execute smoothly.

---

### BUG-05: Missing Production Serverless Entry & Routing for Vercel
- **Bug ID:** `BUG-05`
- **Error Message:** On live site `https://placement-bridge-omega.vercel.app`: `Network error while contacting authentication server. Please try again.`
- **Reproduction Steps:** Deploy repository to Vercel without a serverless API function adapter or rewrite rules.
- **Root Cause:** Vercel serves static Vite build artifacts by default. Because no `vercel.json` or `api/index.ts` existed, requests to `/api/*` returned 404 or were intercepted by Vite's index.html fallback, failing API JSON parsing.
- **Files Affected:** [`api/index.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/api/index.ts), [`vercel.json`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/vercel.json)
- **Fix Applied:**
  1. Created [`api/index.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/api/index.ts) exporting Express `createApiApp()`.
  2. Created [`vercel.json`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/vercel.json) routing `/api/(.*)` to `/api` and non-API paths to `/index.html`.
  3. Added `/api/health` backward-compatible alias alongside `/api/v1/health`.
- **Retest Result:** **PASS** — Express API runs both as a standalone local server and as a Vercel Serverless Function.

---

## 2. Test Execution Verification Matrix (All 28 Tests Pass)

| Suite / Test Name | Expected Behavior | Actual Observed | Result |
|---|---|---|---|
| **H1: Profile Completion Engine** | 0% on empty; 100% on complete | Calculated exact percentages | **PASS** |
| **H2: Eligibility Engine** | Cutoffs pass -> ELIGIBLE; Fail outranks unknown | Evaluated criteria deterministically | **PASS** |
| **H3: Recommendation Engine** | Weighted 30/40/10/10/10 match score | Correct scores & deterministic tie-break | **PASS** |
| **H4 & H5: Skill Gap & Roadmap** | Priority ranking & prerequisite ordering | High/Med/Low assigned, prerequisites locked | **PASS** |
| **H6: Aptitude Quiz Scoring** | Strips answers on attempt; handles 10s grace | Correct payload redaction & scoring | **PASS** |
| **H7: Placement Readiness** | Excludes null categories, marks provisional | Weights normalized properly | **PASS** |
| **I & J: Resume / Rubric / CSV** | Valid PDF, prompt defense, CSV neutralization | `%PDF-1.x` created, CSV formulas escaped | **PASS** |
| **SYS-01: Health Endpoint** | Neon PostgreSQL connected, flags returned | 200 OK, database: "connected", orm: "prisma" | **PASS** |
| **AUTH-01 & 02: Student Registration** | 201 Created, password hashed, 409 on duplicate | 201 Created, no hash leaked, duplicate rejected | **PASS** |
| **AUTH-04: Account Lockout** | 423 Locked after 5 consecutive bad passwords | 423 ACCOUNT_LOCKED on 5th attempt | **PASS** |
| **AUTH-05 & 06: Refresh Token Rotation** | New tokens issued, reuse triggers total revocation | Fresh token issued, reuse revoked all sessions | **PASS** |
| **AUTH-08: RBAC Authorization** | Student role blocked from `/api/v1/admin/*` | 403 FORBIDDEN | **PASS** |
| **PRO-01..04: Portfolio & Invariants** | CGPA <= 10, backlogs validated, IDOR blocked | 400 Bad Request on bad data, 404 on IDOR | **PASS** |
| **CMP / ELG / REC / GAP API** | Persists eligibility, recommendations & gap data | Stored and fetched from Neon PostgreSQL | **PASS** |
| **APT-01..04: Timed Quiz API** | Hides answers, scores on server, prevents resubmit | 409 on double-submit, score computed server-side | **PASS** |
| **COD-01..03: Coding Sandbox** | Hidden test cases kept private, submission logged | Submission logged in DB, private cases masked | **PASS** |
| **INT / RES / RDY API** | Generates real PDF resume, evaluates mock interview | PDF stored in `storage/`, rubric evaluated | **PASS** |
| **ADM-01..04: Admin Custodian** | Authenticates TPO admin, returns SQL analytics | 200 OK with custodian metadata | **PASS** |
| **CRUD-01: Full Database Persistence** | Verify CRUD in Neon for Student, Progress & Admin | Verified Create, Read, Update, Delete across tables | **PASS** |
| **Build Check (`npm run build`)** | Clean build with zero TypeScript or Vite errors | Generated `dist/` bundle (JS, CSS, HTML) | **PASS** |

---

## 3. Architecture & Viva Voce Guide

### 1. Dual-Mode Server Architecture
- **WHAT:** The application can run either as a standalone Node.js server (`server.ts`) or as a Serverless Function on Vercel (`api/index.ts`).
- **WHY:** During local development and testing, running Express and Vite together on `localhost:3000` provides instantaneous hot reload and full logging. In production on Vercel, serverless functions scale automatically to zero when idle, eliminating hosting costs.
- **WHERE:** Local entry: [`server.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/server.ts); Production entry: [`api/index.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/api/index.ts); Routing: [`vercel.json`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/vercel.json).
- **HOW:** `createApiApp()` in `src/server/app.ts` builds the Express instance with all middleware and routes. In `server.ts`, Vite's dev middleware is attached to this Express app so a single port (3000) serves both frontend and backend. In Vercel, `api/index.ts` exports this exact same Express app as the default request listener.

### 2. Database Connection Pooling with Neon PgBouncer
- **WHAT:** PostgreSQL database hosted on Neon serverless cloud using PgBouncer connection pooling.
- **WHY:** Traditional databases keep persistent open connections per client. In serverless environments, hundreds of function instances can spin up simultaneously, rapidly exceeding PostgreSQL connection limits. Neon's PgBouncer aggregates these connections into a shared pool.
- **WHERE:** [`src/db/prisma.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/db/prisma.ts), [`.env`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/.env).
- **HOW:** The connection string contains `pgbouncer=true`. In `src/db/prisma.ts`, `connection_limit` is set to 3 to prevent free-tier slot exhaustion, and `connect_timeout` is set to 30s to allow time for serverless compute wake-up.

### 3. Authentication & Security Pipeline
- **WHAT:** Dual-token JWT authentication (Access Token + Refresh Token) with database-backed session tracking and brute-force lockout.
- **WHY:** Pure stateless JWTs cannot be revoked if compromised before expiration. By storing session records in `UserSession`, active sessions can be revoked on logout or upon detecting refresh-token reuse attacks.
- **WHERE:** [`src/server/middleware/auth.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/server/middleware/auth.ts), [`src/server/routes/auth.routes.ts`](file:///C:/Users/LENOVO/Downloads/PlacementBridge/src/server/routes/auth.routes.ts).
- **HOW:**
  - Passwords are encrypted using `bcrypt` (work factor 12).
  - Short-lived Access Tokens (15 min) are signed using `JWT_ACCESS_SECRET`.
  - Opaque Refresh Tokens (7 days) are hashed with SHA-256 before storage in PostgreSQL.
  - If an already-rotated refresh token is re-submitted, the system flags token theft and revokes all sessions for that user.
  - 5 consecutive failed login attempts lock the account with HTTP `423 Locked`.
