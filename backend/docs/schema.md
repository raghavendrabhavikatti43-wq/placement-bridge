# Placement Bridge — PostgreSQL Database Schema (`src/db/schema.ts`)

Managed with **Drizzle ORM** (`drizzle-orm/pg-core`) on **Google Cloud SQL for PostgreSQL**.

## 1. PostgreSQL Enums (21)

| Enum Name | Values |
| --- | --- |
| `user_role` | `STUDENT`, `ADMIN` |
| `skill_category` | `LANGUAGE`, `FRAMEWORK`, `DATABASE`, `TOOL`, `TECHNICAL`, `SOFT` |
| `skill_importance` | `MUST`, `GOOD` |
| `data_status` | `SAMPLE`, `VERIFIED` |
| `eligibility_status` | `ELIGIBLE`, `NOT_ELIGIBLE`, `INSUFFICIENT_INFO` |
| `criterion_status` | `PASS`, `FAIL`, `UNKNOWN` |
| `gap_status` | `HAVE`, `PARTIAL`, `MISSING` |
| `gap_priority` | `HIGH`, `MEDIUM`, `LOW` |
| `difficulty_level` | `EASY`, `MEDIUM`, `HARD` |
| `resource_type` | `ARTICLE`, `VIDEO`, `PRACTICE`, `DOCS`, `COURSE` |
| `topic_progress_status` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` |
| `question_category` | `QUANTITATIVE`, `LOGICAL`, `VERBAL`, `DATA_INTERPRETATION`, `TECHNICAL_MCQ` |
| `quiz_attempt_status` | `IN_PROGRESS`, `SUBMITTED`, `EXPIRED` |
| `coding_submission_status` | `SAVED`, `SELF_MARKED_SOLVED`, `QUEUED`, `RUNNING`, `PASSED`, `FAILED`, `COMPILE_ERROR`, `RUNTIME_ERROR`, `TLE` |
| `interview_question_type` | `TECHNICAL`, `HR`, `PROJECT`, `COMPANY` |
| `feedback_source` | `RUBRIC`, `AI` |
| `file_asset_kind` | `RESUME`, `CERTIFICATE`, `PROFILE_IMAGE`, `COMPANY_LOGO`, `GENERATED_RESUME` |
| `ai_message_role` | `USER`, `ASSISTANT` |
| `bookmark_kind` | `COMPANY`, `RESOURCE`, `TOPIC`, `INTERVIEW_QUESTION` |
| `notification_kind` | `ANNOUNCEMENT`, `BADGE`, `READINESS`, `SYSTEM`, `DRIVE` |
| `recommendation_feedback` | `HELPFUL`, `NOT_RELEVANT` |

---

## 2. Relational Tables (58)

### Identity, Sessions & Security
1. **`users`**: `id (uuid PK)`, `uid (text unique — Firebase UID / local namespace)`, `email (citext/text unique)`, `password_hash`, `role`, `custodian_code`, `is_active`, `email_verified`, `failed_logins`, `locked_until`, `last_login_at`, `admin_meta (jsonb)`, `created_at`, `updated_at`.
2. **`user_sessions`**: `id (uuid PK)`, `user_id (FK -> users.id CASCADE)`, `refresh_token_hash (SHA-256 unique)`, `replaced_by_hash`, `user_agent`, `ip`, `expires_at`, `revoked_at`, `created_at`.
3. **`password_reset_tokens`**: `id (uuid PK)`, `user_id (FK -> users.id CASCADE)`, `token_hash (SHA-256 unique)`, `expires_at`, `used_at`, `created_at`.
4. **`login_attempts`**: `id (uuid PK)`, `email`, `ip`, `succeeded`, `reason`, `created_at`.
5. **`audit_logs`**: `id (uuid PK)`, `actor_id (FK -> users.id SET NULL)`, `action`, `entity`, `entity_id`, `metadata (jsonb)`, `ip`, `created_at`.

### Student Profile & Portfolio
6. **`student_profiles`**: `id (uuid PK)`, `user_id (unique FK -> users.id CASCADE)`, `full_name`, `phone`, `college`, `degree`, `department`, `semester`, `graduation_year`, `tenth_pct`, `twelfth_pct`, `diploma_pct`, `cgpa`, `total_backlogs`, `active_backlogs`, `target_role`, `leetcode_solved`, `avatar_url`, `avatar_bg`, `bio`, `resume_summary`, `resume_file_id`, `profile_image_id`, `completion_pct`, `portal_settings (jsonb)`, `created_at`, `updated_at`.
7. **`academic_records`**: Semester-wise SGPA (`unique(student_id, semester)`).
8. **`skills`**: Canonical skill dictionary (`id`, `slug unique`, `name unique`, `category`, `aliases text[]`).
9. **`student_skills`**: Student skill proficiency `1..5` (`unique(student_id, skill_id)`).
10. **`projects`**: Student engineering projects (`title`, `description`, `technologies text[]`, `role`, `github_url`).
11. **`project_links`**: Additional demo/documentation URLs per project.
12. **`certifications`**: Verified student credentials (`name`, `issuer`, `credential_url`, `file_id`).
13. **`internships`**: Industry/research internship records.
14. **`achievements`**: Hackathons, competitive ranks, and academic honors.
15. **`student_preferences`**: Target roles, industries, and locations (`unique(student_id)`).
16. **`profile_completion_status`**: Cached section-by-section completion breakdown and missing fields.

### Companies, Drives, Eligibility & Recommendations
17. **`companies`**: Campus recruiters with `data_status ('SAMPLE' | 'VERIFIED')`, `slug unique`, `package_info`, `drive_date`, `days_remaining`, `is_active`.
18. **`company_locations`**: Hiring locations per company.
19. **`job_roles`**: Role offerings per company (`title`, `role_category`, `package_info`, `bond_info`).
20. **`company_requirements`**: Academic cutoffs per `job_role_id` (`min_cgpa`, `min_tenth_pct`, `min_twelfth_pct`, `allowed_branches text[]`, `max_active_backlogs`, `max_total_backlogs`, `graduation_year`).
21. **`company_required_skills`**: Role skill requirements (`importance: 'MUST' | 'GOOD'`, `unique(job_role_id, skill_id)`).
22. **`selection_stages`**: Ordered hiring funnel stages per company.
23. **`company_bookmarks`**: Student company bookmarks (`unique(student_id, company_id)`).
24. **`drive_applications`**: Student campus drive applications (`unique(student_id, company_id)`).
25. **`eligibility_checks`**: Persisted eligibility run headers per student.
26. **`eligibility_results`**: Per-role criterion verdicts (`ELIGIBLE` / `NOT_ELIGIBLE` / `INSUFFICIENT_INFO`, JSON criterion breakdown, `missing_fields`).
27. **`recommendation_runs`**: Recommendation run metadata & coverage notes.
28. **`company_recommendations`**: Ranked role recommendations with 5 component scores, matched/missing skills, explanation, and optional student feedback (`HELPFUL` / `NOT_RELEVANT`).

### Skill Gap & Preparation Roadmap
29. **`skill_gap_reports`**: Persisted skill gap analysis runs (`coverage_pct`).
30. **`skill_gap_items`**: Per-skill `HAVE` / `PARTIAL` / `MISSING` status and `HIGH` / `MEDIUM` / `LOW` priority.
31. **`preparation_topics`**: Structured curriculum topics with self-referencing `prerequisite_id` and `sequence_order`.
32. **`learning_resources`**: Curated external resources linked to `topic_id` and `skill_id`.
33. **`roadmap_items`**: Granular checklist steps inside each preparation topic.
34. **`student_progress`**: Student topic completion state (`unique(student_id, topic_id)`).
35. **`bookmarks`**: Generic polymorphic bookmarks (`RESOURCE`, `TOPIC`, `INTERVIEW_QUESTION`).

### Aptitude, Coding & Interview Practice
36. **`questions`**: Aptitude & Technical MCQ bank (`category`, `subtopic`, `difficulty`, `explanation`).
37. **`question_options`**: Answer choices (`is_correct` never serialized during active attempts).
38. **`quizzes`**: Configured timed assessments (`time_limit_sec`, `category`).
39. **`quiz_questions`**: Ordered question mapping per quiz.
40. **`quiz_attempts`**: Server-timed attempts (`started_at`, `deadline_at`, `submitted_at`, `status`, `score`, `total`).
41. **`quiz_answers`**: Per-question autosaved/submitted answers (`unique(attempt_id, question_id)`).
42. **`coding_languages`**: Supported coding languages (`java`, `python`, `cpp`, `javascript`).
43. **`coding_problems`**: DSA problems (`slug unique`, `difficulty`, `topic`, `constraints`, `starter_code jsonb`, `hints text[]`).
44. **`coding_test_cases`**: Sample (`is_hidden = false`) and hidden (`is_hidden = true`) test cases.
45. **`coding_submissions`**: Saved / self-marked / sandbox submissions (`status`, `execution_provider`).
46. **`coding_submission_results`**: Per-test-case execution metrics when sandbox provider is enabled.
47. **`interview_questions`**: Technical, HR, Project, and Company-tagged interview prompts with `answer_guidance` and `key_points`.
48. **`interview_sessions`**: Practice interview sessions (`type`, `question_ids`, `completed_at`).
49. **`interview_answers`**: Written student answers per session question.
50. **`interview_feedback`**: Deterministic `RUBRIC` or grounded `AI` 4-dimension scores (`relevance`, `structure`, `completeness`, `clarity`).

### Resumes, Grounded AI, Readiness, Progress & Notifications
51. **`file_assets`**: Validated file uploads & generated PDFs (`owner_id`, `kind`, `storage_key`, `mime_type`, `sha256`).
52. **`resumes`**: Versioned structured resumes (`template`, `version`, `content jsonb`, `is_primary`, `generated_file_id`).
53. **`resume_analyses`**: Deterministic JD keyword & section audits (`extracted jsonb`, `keyword_match_pct`, `suggestions jsonb`).
54. **`ai_conversations`**: Per-student grounded placement advisor threads.
55. **`ai_messages`**: Persisted user & assistant messages with `used_facts` audit array.
56. **`readiness_scores`** & **`readiness_category_scores`**: Historical readiness snapshots (`overall_score`, `is_provisional`, `coverage_pct`) and 6 category sub-scores.
57. **`learning_activity_logs`**, **`badges`**, **`student_badges`**: Daily streak activity log and idempotently awarded milestone badges (`unique(student_id, badge_id)`).
58. **`announcements`**, **`announcement_recipients`**, **`notifications`**: Targeted TPO announcements and per-user inbox notifications.
