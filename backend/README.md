# Placement Bridge — Full-Stack PostgreSQL Backend

Complete, persistent **Google Cloud SQL for PostgreSQL** + **Drizzle ORM** + **Express** + **Firebase Auth** + **Grounded Gemini AI** backend integrated with the existing **Placement Bridge / Placement Guidance** React frontend without modifying any existing UI/UX components.

## Quick Commands

```bash
# Start full-stack dev server (Express API + Vite SPA on port 3000)
npm run dev

# Run idempotent PostgreSQL seed (companies marked dataStatus = 'SAMPLE')
npm run db:seed

# Provision or rotate the single TPO Administrator account out-of-band
npm run create-admin

# Run automated unit + live PostgreSQL Supertest integration suites
npm test

# Type-check entire frontend + backend codebase
npm run lint
```

## Pre-Seeded Verification Credentials

### 1. Restricted TPO Admin Console (`/api/v1/auth/admin/login` & `/api/auth/admin/login`)
- **Custodian User ID**: `TPO-ADMIN-01`
- **Official Email**: `admin.tpo@nie-placement.edu`
- **Password**: `NieTpo@2026#Secure!`
- **Security Challenge**: Fetched dynamically via `GET /api/v1/auth/challenge`

### 2. Student Career Portal (`/api/v1/auth/login` & `/api/auth/student/email`)
- **Primary Student Email**: `aditya.sharma@nie.edu.in`
- **Password**: `Student@2026!`
- *(Plus 9 additional diverse department/CGPA student accounts seeded in PostgreSQL, open student registration, and Firebase Google Sign-In)*

## Documentation Index (`/backend/docs/`)

- [`frontend-audit.md`](./docs/frontend-audit.md) — Frontend audit & route mapping
- [`architecture.md`](./docs/architecture.md) — Layered system architecture & ASCII diagram
- [`schema.md`](./docs/schema.md) — 58 PostgreSQL tables & 21 enums (`src/db/schema.ts`)
- [`api.md`](./docs/api.md) — `/api/v1/*` REST endpoint catalogue & JSON envelopes
- [`openapi.yaml`](./docs/openapi.yaml) — OpenAPI 3.1 specification (served at `GET /api/docs`)
- [`security.md`](./docs/security.md) — Authentication, RBAC, IDOR, magic-byte upload, CSV & AI defenses
- [`test-cases.md`](./docs/test-cases.md) — Unit & PostgreSQL integration test matrix
- [`deployment.md`](./docs/deployment.md) — Cloud SQL configuration, seeding, and operations
