# Placement Bridge — Security Architecture & OWASP Hardening

## 1. Authentication, Password Hashing & Session Lifecycle
- **Password Hashing**: `bcryptjs` with **cost factor 12** (`$2b$12$...`). Password hashes and session token hashes are never serialized in API responses or logs.
- **Timing-Attack Equalization**: Login endpoints compare against a precomputed cost-12 dummy hash when an email does not exist so response latency does not leak account existence.
- **Brute-Force Account Lockout**: 5 consecutive failed password attempts lock the account for **15 minutes** (`423 ACCOUNT_LOCKED`) and record a structured audit entry.
- **Short-Lived Access JWT + Rotating Opaque Refresh Tokens**:
  - Access JWT (`HS256`, default `15m`) carries `{ sub, role, sessionId }`.
  - Opaque 256-bit refresh tokens are stored exclusively as **SHA-256 hashes** in `user_sessions`.
  - **Refresh Token Reuse Detection**: Every `/api/v1/auth/refresh` rotates the refresh token (`replaced_by_hash`). Presenting an already-rotated refresh token immediately **revokes all active sessions** for that user (`401 REFRESH_TOKEN_REUSED`) and writes an audit alert.
- **Single-Custodian Admin Gate**: Admin login requires matching `custodianCode` (`TPO-ADMIN-01`), `email`, `password`, and a single-use 5-minute server-generated security challenge; public registration cannot create `ADMIN` accounts.

## 2. Authorization, RBAC & IDOR Prevention
- **Role-Based Access Control**: `requireRole('ADMIN')` protects every route mounted under `/api/v1/admin/*`; `requireRole('STUDENT')` isolates candidate endpoints.
- **Ownership Enforcement (Anti-IDOR)**: All student resource queries (`projects`, `certifications`, `internships`, `achievements`, `resumes`, `quiz_attempts`, `interview_sessions`, `ai_conversations`, `notifications`) scope `WHERE` clauses by `req.auth.studentId` derived from the verified server session — never trusting client-supplied IDs. Cross-student mutations return `404`.

## 3. Input Validation, SQL Safety & CSV Formula Defense
- **Zod Request Validation**: Request bodies are validated via `validateBody(schema)` with length caps and numeric bounds (`0 <= cgpa <= 10`, `0 <= pct <= 100`, `totalBacklogs >= activeBacklogs`).
- **Parameterized Queries Only**: All database reads and writes run through **Drizzle ORM** parameterized statements (`pg.Pool`), eliminating SQL injection.
- **CSV Formula Injection Neutralization**: Every cell exported by `/api/v1/admin/reports/*.csv` passes through `escapeCsvCell()`, prefixing leading `=`, `+`, `-`, `@`, `\t`, or `\r` characters with `'` so spreadsheet software treats untrusted student text as literal strings.

## 4. File Upload & Download Hardening
- **Memory-Buffered Magic-Byte Verification**: Uploads use `multer.memoryStorage()` with strict byte caps (`2 MB` resumes/certificates, `1 MB` images) and inspect actual binary magic bytes via `file-type` (`%PDF`, OOXML `PK`, `PNG`, `JPEG`, `WEBP`). Spoofed executables (e.g., `MZ` header renamed `.pdf`) are rejected with `400 MAGIC_BYTE_MISMATCH`.
- **Private Storage & Signed URLs**: Files are stored outside static web roots with UUID keys (`uploads/<kind>/<uuid>.<ext>`) and served only through short-lived HMAC-SHA256 signed download URLs with `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment`.

## 5. Assessment, Code Execution & AI Safety
- **Zero Server-Side Arbitrary Code Execution**: Student code submissions are **never** executed via `eval`, `vm`, or `child_process` on the API host (`CODE_EXECUTION_PROVIDER=disabled` -> `PRACTICE` mode).
- **Hidden Test Case & Active Quiz Protection**: `GET /coding/problems/:id` filters `is_hidden = false`; active quiz attempts strip `isCorrect` and `explanation` until `SUBMITTED` or `EXPIRED`.
- **Grounded AI & Prompt-Injection Defense**:
  - `GEMINI_API_KEY` stays strictly server-side (`src/server/integrations/gemini.ts`).
  - Emails, phone numbers, URLs, and student names are stripped via `redactPiiFromText()` before model invocation, and CGPA is bucketed into bands.
  - Untrusted student text is isolated inside `<UNTRUSTED_*>` XML delimiters with explicit system instructions forbidding ungrounded company/cutoff fabrication.
