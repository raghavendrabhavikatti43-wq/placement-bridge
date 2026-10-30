# Placement Bridge — REST API Reference (`/api/v1`)

All `/api/v1/*` endpoints return the uniform JSON envelope:

### Success Envelope
```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 16,
    "totalPages": 1
  }
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Validation failed",
  "errors": [{ "field": "cgpa", "message": "Number must be less than or equal to 10" }],
  "code": "VALIDATION_ERROR",
  "requestId": "6c4e12f1-84c5-48c4-93f6-7a85100f72b1"
}
```

---

## 1. System & Health
- `GET /api/v1/health` — Returns PostgreSQL connectivity (`connected`) and active runtime capabilities (`aiEnabled`, `executionEnabled`, `emailEnabled`, `storageDriver`).
- `GET /api/docs` — Serves OpenAPI 3.1 YAML specification (`backend/docs/openapi.yaml`).

## 2. Authentication & Session Security (`/api/v1/auth`)
- `GET /api/v1/auth/challenge` — Generates single-use 5-minute cryptographic challenge for TPO Admin login.
- `POST /api/v1/auth/register` — Registers a new student (`email`, strong `password`, `fullName`, `department`, `graduationYear`, `cgpa`).
- `POST /api/v1/auth/login` — Authenticates student with constant-time dummy-hash equalization and 5-strike 15-minute lockout (`423 ACCOUNT_LOCKED`).
- `POST /api/v1/auth/admin/login` — Authenticates the single TPO Admin custodian (`userId`, `email`, `password`, `challengeId`, `challengeAnswer`).
- `POST /api/v1/auth/oauth/google` — Verifies Firebase Google `idToken` via `adminAuth.verifyIdToken` and upserts the student in PostgreSQL.
- `POST /api/v1/auth/continue` — Federated student sign-in (`google` | `institutional-sso` | `github`).
- `POST /api/v1/auth/refresh` — Rotates opaque refresh token (`SHA-256` hashed in `user_sessions`); **reusing an already-rotated token immediately revokes all active sessions for that user (`401 REFRESH_TOKEN_REUSED`)**.
- `POST /api/v1/auth/logout` — Revokes active session and clears auth cookies.
- `GET /api/v1/auth/me` — Returns authenticated user identity and capability flags.
- `POST /api/v1/auth/forgot-password` / `POST /api/v1/auth/reset-password` / `POST /api/v1/auth/change-password`.

## 3. Student Profile & Hardened File Uploads (`/api/v1`)
- `GET /api/v1/students/me` / `PUT /api/v1/students/me` — Reads or updates student profile, semester academics, and skills; recalculates H1 completion and H7 readiness.
- `GET /api/v1/students/me/completion` — Section-level completion breakdown and missing items.
- `GET /api/v1/skills` — Canonical skill catalogue (`?q=`, `?category=`).
- `POST /api/v1/students/me/skills` / `PUT /api/v1/students/me/skills/:skillId` / `DELETE /api/v1/students/me/skills/:skillId`.
- `POST|PUT|DELETE /api/v1/students/me/projects[/:id]` — Student-owned projects (IDOR-guarded).
- `POST|PUT|DELETE /api/v1/students/me/certifications[/:id]` — Student-owned certifications.
- `POST|PUT|DELETE /api/v1/students/me/internships[/:id]` — Student-owned internships.
- `POST|PUT|DELETE /api/v1/students/me/achievements[/:id]` — Student-owned achievements.
- `PUT /api/v1/students/me/preferences` — Target roles, industries, and locations.
- `POST /api/v1/students/me/profile-image` — Multipart avatar upload (`<= 1 MB`, PNG/JPEG/WEBP magic-byte verified).
- `POST /api/v1/files/resume` — Multipart PDF/DOCX upload (`<= 2 MB`, magic-byte verified).
- `POST /api/v1/files/certificate` — Multipart PDF/PNG/JPEG upload (`<= 2 MB`, magic-byte verified).
- `GET /api/v1/files/:id/url` / `GET /api/v1/files/:id/download` / `DELETE /api/v1/files/:id` — Short-lived HMAC-signed private download URLs (`X-Content-Type-Options: nosniff`).

## 4. Companies, Eligibility & Recommendations (`/api/v1`)
- `GET /api/v1/companies` / `GET /api/v1/companies/:id` — Paginated company & role explorer with `dataStatus` (`SAMPLE` | `VERIFIED`), H2 eligibility, and H3 match score.
- `GET|POST|DELETE /api/v1/bookmarks/companies[/:companyId]`.
- `GET|POST|PUT /api/v1/applications[/:id]` — Campus drive application tracker.
- `POST /api/v1/eligibility/check` & `GET /api/v1/eligibility/history` — Persisted H2 eligibility evaluations.
- `POST /api/v1/recommendations/run`, `GET /api/v1/recommendations/latest`, `POST /api/v1/recommendations/:id/feedback`.

## 5. Skill Gap & Preparation Roadmap (`/api/v1`)
- `POST /api/v1/skill-gap` & `GET /api/v1/skill-gap/history` — H4 skill gap matrix + prerequisite-ordered roadmap topics.
- `GET /api/v1/preparation/topics`, `GET /api/v1/preparation/topics/:id`, `PUT /api/v1/preparation/topics/:id/progress`.
- `GET /api/v1/preparation/roadmap` & `GET /api/v1/preparation/next` — H5 unlocked roadmap & next priority topic.
- `GET /api/v1/resources`, `GET|POST|DELETE /api/v1/bookmarks/items[/:id]`.

## 6. Aptitude, Coding & Interview Practice (`/api/v1`)
- **Aptitude**: `GET /aptitude/categories`, `GET /aptitude/quizzes`, `POST /aptitude/attempts` (strips `isCorrect` & `explanation`), `PUT /aptitude/attempts/:id/answers`, `POST /aptitude/attempts/:id/submit` (server-timed with 10s grace), `GET /aptitude/attempts/:id`, `GET /aptitude/performance`.
- **Coding**: `GET /coding/problems`, `GET /coding/problems/:id` (returns `isHidden = false` sample test cases only), `POST /coding/problems/:id/submissions` (`PRACTICE` mode when `executionEnabled = false`), `GET /coding/submissions`, `GET /coding/submissions/:id/status`, `GET /coding/performance`.
- **Interview**: `GET /interview/questions`, `GET /interview/questions/:id`, `POST /interview/sessions`, `POST /interview/sessions/:id/answers/:questionId` (`RUBRIC` + optional grounded `AI` feedback), `POST /interview/sessions/:id/complete`, `GET /interview/history`.

## 7. Resumes, Grounded AI, Readiness & Progress (`/api/v1`)
- **Resumes**: `GET /resume/data`, `POST /resume`, `GET /resume`, `GET /resume/:id`, `PUT /resume/:id/primary`, `POST /resume/:id/pdf` (`pdfkit` PDF generator), `POST /resume/analyze` (deterministic keyword/section audit + optional Gemini phrasing improvements), `GET /resume/analyses`.
- **AI**: `GET /ai/status`, `POST /ai/chat` (DB-grounded `FACTS` block, PII redacted, `<UNTRUSTED_*>` delimited), `GET /ai/conversations`, `GET /ai/conversations/:id`, `DELETE /ai/conversations/:id`, `POST /ai/code-review`, `POST /ai/mock-interview`.
- **Progress & Readiness**: `GET /progress/overview`, `GET /progress/weekly`, `GET /progress/monthly`, `GET /progress/categories`, `GET /progress/activity`, `GET /progress/badges`, `GET /readiness`, `POST /readiness/recalculate`, `GET /readiness/history`, `GET /dashboard`, `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `PUT /notifications/:id/archive`, `GET /announcements`.

## 8. Admin Panel & SQL Analytics (`/api/v1/admin/*` — `ADMIN` Role Required)
- `GET /overview`, `PUT /profile`
- `GET /students`, `GET /students/:id`, `PATCH /students/:id/status`, `POST /students/:id/reset-password`
- `POST|PUT|DELETE /companies[/:id]`, `POST /companies/:id/logo`, `PUT /companies/:id/stages`
- `POST|PUT|DELETE /job-roles[/:id]`, `PUT /job-roles/:id/requirements`, `PUT /job-roles/:id/skills`
- `PATCH /applications/:id`
- `GET|POST|PUT|DELETE /questions[/:id]`, `POST|PUT /quizzes[/:id]`, `POST|PUT|DELETE /coding/problems[/:id]`, `PUT /coding/problems/:id/test-cases`, `POST|PUT|DELETE /interview/questions[/:id]`, `POST /topics`, `POST /resources`, `POST /skills`
- `POST /announcements`, `POST /announcements/:id/publish`
- `GET /analytics/{eligibility,readiness-distribution,quiz-performance,coding-performance,skill-gaps,departments,preparation,registrations}` (cached 5 min)
- `GET /reports/students.csv`, `GET /reports/analytics.csv` (formula-injection escaped)
- `GET /audit-logs`
