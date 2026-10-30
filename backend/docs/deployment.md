# Placement Bridge — Deployment & Operations Guide

## 1. Runtime & Database Provisioning
- **Application Runtime**: Node.js 20+ (`tsx server.ts` in development, `vite build` + `node server.ts` in production on `PORT=3000`).
- **Database**: **Google Cloud SQL for PostgreSQL** connected via the Cloud SQL Auth Proxy Unix socket / host injected into `SQL_HOST`.
- **Connection Pooling**: `src/db/index.ts` initializes a singleton `pg.Pool` using the **Object Method** (`host: process.env.SQL_HOST`, `user: process.env.SQL_USER`, `password: process.env.SQL_PASSWORD`, `database: process.env.SQL_DB_NAME`, `max: 10`, `connectionTimeoutMillis: 15000`) with lazy on-demand connection checkout and zero startup probe loops.

## 2. Required & Optional Environment Variables (`.env.example`)

| Variable | Scope | Description |
| --- | --- | --- |
| `SQL_HOST` | Cloud SQL Runtime | Cloud SQL Auth Proxy socket path / host |
| `SQL_DB_NAME` | Cloud SQL Runtime | PostgreSQL database name |
| `SQL_USER` | Cloud SQL Runtime | Least-privilege application read/write DB user |
| `SQL_PASSWORD` | Cloud SQL Runtime | Password for `SQL_USER` |
| `SQL_ADMIN_USER` | Drizzle Migrations | Admin DB user used exclusively by `src/db/drizzle.config.ts` |
| `SQL_ADMIN_PASSWORD` | Drizzle Migrations | Password for `SQL_ADMIN_USER` |
| `JWT_ACCESS_SECRET` | Auth Security | Secret (>= 32 chars in production) for signing short-lived access JWTs |
| `JWT_REFRESH_SECRET` | Auth Security | Secret (>= 32 chars in production) for signing download URLs & token HMACs |
| `GEMINI_API_KEY` | Server AI (Optional) | Server-only Google Gemini API key (`gemini-3.8-flash`); deterministic engines work when unset |
| `CODE_EXECUTION_PROVIDER` | Coding Mode | `disabled` (default `PRACTICE` mode) or `judge0` |
| `STORAGE_DRIVER` | File Uploads | `local` (default private `uploads/` directory) |

## 3. Schema Push, Seeding & Admin Provisioning

1. **Apply Drizzle Schema**:
   Managed via AI Studio Cloud SQL `UpdateSchema` (`src/db/schema.ts` + `src/db/drizzle.config.ts`).
2. **Seed Sample Placement Data (Idempotent)**:
   ```bash
   npm run db:seed
   ```
   Populates sample companies (`dataStatus = 'SAMPLE'`), skills, aptitude questions, coding problems, interview questions, preparation topics, resources, badges, 10 sample students, and the TPO custodian account.
3. **Provision or Rotate TPO Admin Out-of-Band**:
   ```bash
   ADMIN_EMAIL="admin.tpo@nie-placement.edu" ADMIN_PASSWORD="StrongNewPassword#2026!" npm run create-admin
   ```

## 4. Health Monitoring & Graceful Shutdown
- **Health Endpoint**: `GET /api/v1/health` executes a lightweight `SELECT 1` check and returns `200` (`database: "connected"`) or `503` (`database: "unreachable"`).
- **Graceful Shutdown**: `server.ts` listens for `SIGTERM` and `SIGINT`, stops accepting new HTTP connections, drains active requests, and closes `pg.Pool` cleanly within a 10-second timeout.
