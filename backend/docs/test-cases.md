# Placement Bridge — Automated Test Catalogue (`Part K`)

Run the full automated unit + PostgreSQL integration suite via:

```bash
npm test
```

## 1. Unit Tests (`tests/unit/engines.test.ts`)

| Test Group | Coverage Verified |
| --- | --- |
| **H1 Profile Completion** | `0%` empty baseline, partial skill scaling, `100%` complete profile, exact `15/25/20/15/5/5/10/5` section weights. |
| **H2 Eligibility Engine** | Branch alias normalization (`Computer Engg (CSE)` -> `CSE`, `All B.Tech Branches` -> `ALL`), `ELIGIBLE`, `INSUFFICIENT_INFO` on null required fields, and **`FAIL` strictly outranking `UNKNOWN` (`ELG-03`)**. |
| **H3 Recommendation Engine** | Weighted `30/40/10/10/10` scoring, `MUST=2` vs `GOOD=1` skill weights, deterministic tie-breaking, and non-ML human explanation strings. |
| **H4 & H5 Skill Gap & Roadmap** | `HAVE`/`PARTIAL`/`MISSING` detection, `HIGH`/`MEDIUM`/`LOW` priority assignment, prerequisite topological sorting, and topic lock/unlock transitions. |
| **H6 Timed Quiz Scoring** | Stripping `isCorrect` & `explanation` on active attempts, `10s` grace acceptance (`SUBMITTED`, `late=true`), and post-grace `EXPIRED` scoring **only** autosaved answers. |
| **H7 Placement Readiness** | `20/25/15/15/15/10` weights, excluding `null` categories without treating missing data as `0` or `100`, `isProvisional=true` when `coveragePct < 100`, and `READINESS_DISCLAIMER`. |
| **Resume, PDF, Rubric & Security** | `%PDF-` binary generation via `pdfkit`, deterministic JD keyword match %, text interview rubric scoring, PII redaction, `<UNTRUSTED_*>` wrapping, and CSV formula injection escaping (`=`, `+`, `@`). |

---

## 2. Live PostgreSQL Integration Tests (`tests/integration/api.test.ts`)

| ID | Endpoint / Flow | Assertion |
| --- | --- | --- |
| `SYS-01` | `GET /api/v1/health` | `200`, `database: "connected"`, `executionEnabled: false`, `X-Request-Id` header set. |
| `AUTH-01..02` | `POST /api/v1/auth/register` | `201` without `passwordHash`; duplicate email returns `409`. |
| `AUTH-04` | `POST /api/v1/auth/login` | 5 failed password attempts trigger `423 ACCOUNT_LOCKED`. |
| `AUTH-05..06` | `POST /api/v1/auth/refresh` | Rotates refresh token; replaying old token returns `401 REFRESH_TOKEN_REUSED` and revokes **all** active sessions. |
| `AUTH-08` | `GET /api/v1/admin/overview` | Student token receives `403 FORBIDDEN`. |
| `PRO-01..04` | `PUT /students/me`, `/projects/:id` | Rejects `cgpa: 12` (`400`) and `totalBacklogs < activeBacklogs` (`400`); Student B updating/deleting Student A's project receives `404` (IDOR blocked). |
| `CMP/ELG/REC/GAP` | `/companies`, `/eligibility/check`, `/recommendations/run`, `/skill-gap` | Returns `dataStatus: "SAMPLE"` and persists deterministic checks, ranked recommendations, and skill gap reports in PostgreSQL. |
| `APT-01..04` | `/aptitude/attempts[/:id/submit]` | Active attempt omits `isCorrect` & `explanation`; submit ignores forged `score: 999`; second submit returns `409`. |
| `COD-01..03` | `/coding/problems[/:id/submissions]` | Sample test cases only (`isHidden` never leaked); `PRACTICE` submission records `executed: false` and `SELF_MARKED_SOLVED`. |
| `INT/RES/RDY` | `/interview/*`, `/resume/*`, `/files/resume`, `/readiness`, `/dashboard` | Rubric evaluation (`RUBRIC`), real `%PDF-` generation + signed URL download, spoofed `MZ` `.exe` renamed `.pdf` rejected (`400`), and readiness disclaimer verified. |
| `ADM-01..04` | `/auth/admin/login`, `/admin/analytics/departments`, `/admin/reports/students.csv` | Single-custodian challenge login succeeds, SQL department analytics returned, and `=FormulaTest` name escaped as `'=FormulaTest` in CSV output. |
