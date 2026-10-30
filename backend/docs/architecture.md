# Placement Bridge — Backend Architecture

## 1. System Overview & Architectural Principles

Placement Bridge uses a layered, modular full-stack Node.js + TypeScript architecture running Express 4 alongside the Vite SPA (`PORT=3000`) and backed by **Google Cloud SQL for PostgreSQL** via **Drizzle ORM** (`drizzle-orm/node-postgres`) and **Firebase Authentication** (`firebase-admin`).

1. **Zero UI Modification Guarantee**: All existing React + Tailwind Student Portal and Restricted TPO Admin Console views remain untouched visually; data flows through `/api/v1/*` and PostgreSQL-backed `/api/*` compatibility handlers.
2. **Deterministic Core, Optional Grounded AI**: Every score, eligibility verdict, recommendation rank, skill gap report, quiz mark, readiness calculation, and interview rubric operates deterministically in pure TypeScript engines (`src/server/engines/*`). Server-side Gemini (`gemini-3.8-flash`) enriches chat, resume wording, code reviews, and mock interviews using a strictly grounded `FACTS (from the database)` block with automatic deterministic fallbacks.
3. **Honest Execution & Criteria Boundaries**:
   - Arbitrary student source code is **never** executed inside the Node.js API server (`CODE_EXECUTION_PROVIDER=disabled` -> `PRACTICE` mode with `executed: false`).
   - Seeded company cutoffs carry `dataStatus = 'SAMPLE'` until verified by an administrator.
   - Readiness scores always include `READINESS_DISCLAIMER` and mark `isProvisional = true` whenever category coverage is `< 100%`.

---

## 2. ASCII System Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                        Existing React 19 + Tailwind Frontend                      |
|  Student Portal Views (Dashboard, Companies, Eligibility, Practice, AI, Profile)  |
|  Restricted TPO Admin Console (Overview, Drives, Candidates, Security Audit)      |
+-----------------------------------------+-----------------------------------------+
                                          |
                        Typed HTTP Client (src/services/api/*)
               Bearer JWT + HttpOnly Refresh Cookie + 401 Single-Flight Retry
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         Express API Gateway (server.ts / app.ts)                  |
|  - Request ID (X-Request-Id) + Structured Redacted Pino Logger                    |
|  - Iframe-Safe Helmet + Strict CORS + Cookie Parser + 1 MB JSON Limit             |
|  - Tiered Rate Limiters (Global / Auth / AI / File Uploads)                       |
+--------------------+--------------------+--------------------+--------------------+
                     |                    |                    |
        /api/v1/* Routers        /api/* Legacy Compat      /api/docs
   (Auth, Student, Companies,   (PostgreSQL-backed sync    (OpenAPI 3.1 YAML)
    Prep, Practice, Resume/AI,   for existing screens)
    Progress, Admin RBAC)
                     |                    |
                     +---------+----------+
                               |
                               v
+-----------------------------------------------------------------------------------+
|                Service & Deterministic Engine Layer (src/server/*)                |
|  - H1 Profile Completion (15/25/20/15/5/5/10/5)                                   |
|  - H2 Rule-Based Eligibility (FAIL strictly outranks UNKNOWN + Branch Aliases)    |
|  - H3 Weighted Recommendations (30/40/10/10/10 + Null Renormalization)            |
|  - H4 Skill Gap & Prerequisite Topological Roadmap                                |
|  - H5 Next Recommended Topic Unlocked Evaluator                                   |
|  - H6 Timed Quiz Server Scorer (10s Grace, Post-Grace Autosave-Only Scoring)      |
|  - H7 Placement Readiness (20/25/15/15/15/10 + Provisional Flag)                  |
|  - H8 Streak & Idempotent Badge Evaluator  |  H9 Cached SQL Analytics             |
|  - Resume Analyzer + PDFKit Generator      |  Text Interview Rubric Evaluator     |
+--------------------+-----------------------+-----------------------+--------------+
                     |                       |                       |
                     v                       v                       v
      +-----------------------------+ +--------------+ +----------------------------+
      | Drizzle ORM + pg.Pool       | | Firebase     | | Grounded Gemini SDK        |
      | (Object Method: SQL_HOST,   | | Admin SDK    | | (@google/genai,            |
      |  SQL_USER, SQL_PASSWORD,    | | (Google ID   | |  gemini-3.8-flash, PII     |
      |  SQL_DB_NAME)               | |  Token Auth) | |  Redaction + Delimiters)   |
      +--------------+--------------+ +--------------+ +----------------------------+
                     |
                     v
      +-----------------------------+
      | Cloud SQL for PostgreSQL    |
      | (58 Tables, 21 Enums)       |
      +-----------------------------+
```

---

## 3. Directory Layout

- `/server.ts` — Production & dev HTTP server bootstrap mounting `createApiApp()`, Vite middleware (dev) or static `dist` (prod), and graceful `SIGTERM`/`SIGINT` pool shutdown.
- `/src/db/`
  - `schema.ts` — Complete Drizzle PostgreSQL schema (58 tables, 21 enums, foreign keys, composite unique constraints, and B-tree indexes).
  - `drizzle.config.ts` — Drizzle Kit migration config using `SQL_ADMIN_USER` / `SQL_ADMIN_PASSWORD`.
  - `index.ts` — Lazy singleton `pg.Pool` configured via the Object Method (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`).
  - `users.ts` — Safe `onConflictDoUpdate` user upsert & profile completion persistence helpers.
  - `seed.ts` — Idempotent seed populating 1 TPO Admin, 10 diverse students, 48 skills, 16 companies (`SAMPLE`), 140 aptitude questions, 27 coding problems, 62 interview questions, 42 preparation topics, 42 curated resources, and 8 badges.
  - `createAdmin.ts` — Out-of-band CLI script (`npm run create-admin`) for provisioning/rotating the admin custodian.
- `/src/server/`
  - `config/` — Zod-validated environment configuration (`env.ts`) and secret-redacting `pino` logger (`logger.ts`).
  - `engines/` — Pure, deterministic unit-tested domain engines (`H1`–`H7`, `resumeAnalyzer`, `interviewRubric`, `redaction`).
  - `integrations/` — Hardened magic-byte file storage (`storage.ts`), grounded Gemini wrapper (`gemini.ts`), code-execution interface (`codeExecution.ts`), and transactional email adapter (`email.ts`).
  - `middleware/` — JWT + Firebase authentication, RBAC (`STUDENT` / `ADMIN`), rate limiters, Zod body validator, and centralized error envelope handler.
  - `services/` — Cross-module PostgreSQL query orchestrators (`studentDataService.ts`).
  - `routes/` — Versioned `/api/v1/*` domain routers + PostgreSQL-backed `/api/*` compatibility router.
- `/src/services/api/` — Frontend HTTP client (`client.ts`) and typed domain SDK (`index.ts`).
- `/tests/` — Vitest unit tests (`tests/unit/engines.test.ts`) and Supertest PostgreSQL integration tests (`tests/integration/api.test.ts`).
