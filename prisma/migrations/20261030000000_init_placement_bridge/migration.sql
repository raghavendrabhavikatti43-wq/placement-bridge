-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "role" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "data_status" AS ENUM ('SAMPLE', 'VERIFIED');

-- CreateEnum
CREATE TYPE "skill_category" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'DATABASE', 'TOOL', 'TECHNICAL', 'SOFT');

-- CreateEnum
CREATE TYPE "importance" AS ENUM ('MUST', 'GOOD');

-- CreateEnum
CREATE TYPE "eligibility_status" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'INSUFFICIENT_INFO');

-- CreateEnum
CREATE TYPE "criterion_status" AS ENUM ('PASS', 'FAIL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "skill_gap_status" AS ENUM ('HAVE', 'PARTIAL', 'MISSING');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "resource_type" AS ENUM ('VIDEO', 'ARTICLE', 'COURSE', 'PRACTICE');

-- CreateEnum
CREATE TYPE "progress_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "question_category" AS ENUM ('QUANT', 'LOGICAL', 'VERBAL', 'NUMBER_SYSTEMS', 'PERCENTAGES', 'PROFIT_LOSS', 'TIME_WORK', 'TSD', 'PROBABILITY', 'PERM_COMB', 'CODING_DECODING', 'SERIES', 'PUZZLES');

-- CreateEnum
CREATE TYPE "attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('ATTEMPTED', 'SELF_MARKED_SOLVED', 'PASSED', 'FAILED', 'ERROR');

-- CreateEnum
CREATE TYPE "interview_type" AS ENUM ('TECHNICAL', 'HR', 'PROJECT', 'COMPANY');

-- CreateEnum
CREATE TYPE "feedback_source" AS ENUM ('RUBRIC', 'AI');

-- CreateEnum
CREATE TYPE "file_kind" AS ENUM ('PROFILE_IMAGE', 'RESUME', 'CERTIFICATE', 'COMPANY_LOGO', 'GENERATED_RESUME');

-- CreateEnum
CREATE TYPE "ai_role" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('SYSTEM', 'ANNOUNCEMENT', 'PREPARATION', 'COMPANY', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "announcement_status" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "bookmark_kind" AS ENUM ('RESOURCE', 'TOPIC', 'INTERVIEW_QUESTION');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uid" TEXT NOT NULL,
    "custodian_code" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "role" NOT NULL DEFAULT 'STUDENT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "admin_meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID,
    "kind" "file_kind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "content_base64" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "college" TEXT DEFAULT 'National Institute of Engineering',
    "degree" TEXT DEFAULT 'B.Tech',
    "department" TEXT,
    "semester" INTEGER DEFAULT 7,
    "graduation_year" INTEGER DEFAULT 2027,
    "tenth_pct" DECIMAL(5,2),
    "twelfth_pct" DECIMAL(5,2),
    "diploma_pct" DECIMAL(5,2),
    "cgpa" DECIMAL(4,2),
    "total_backlogs" INTEGER DEFAULT 0,
    "active_backlogs" INTEGER DEFAULT 0,
    "target_role" TEXT DEFAULT 'Software Engineer (SDE-1)',
    "leetcode_solved" INTEGER DEFAULT 0,
    "profile_image_id" UUID,
    "avatar_url" TEXT DEFAULT '',
    "avatar_bg" TEXT DEFAULT 'indigo',
    "bio" TEXT,
    "resume_summary" TEXT,
    "portal_settings" JSONB,
    "completion_pct" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "semester" INTEGER NOT NULL,
    "sgpa" DECIMAL(4,2) NOT NULL,
    "backlogs_in_semester" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "academic_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "category" "skill_category" NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_skills" (
    "student_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 3,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_skills_pkey" PRIMARY KEY ("student_id","skill_id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" TEXT,
    "github_url" TEXT,
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "issued_on" TIMESTAMPTZ(6),
    "credential_url" TEXT,
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "achieved_on" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_preferences" (
    "student_id" UUID NOT NULL,
    "preferred_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_locations" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "student_preferences_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'classic',
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "file_id" UUID,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "file_id" UUID,
    "job_description" TEXT,
    "extracted" JSONB NOT NULL,
    "keyword_match_pct" INTEGER,
    "suggestions" JSONB NOT NULL,
    "ai_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "logo_file_id" UUID,
    "logo_url" TEXT,
    "logo_icon" TEXT DEFAULT 'apartment',
    "category" TEXT DEFAULT 'Campus Recruiter',
    "description" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "location" TEXT,
    "package_info" TEXT,
    "drive_date" TEXT,
    "days_remaining" INTEGER DEFAULT 14,
    "institutional_notes" TEXT,
    "data_status" "data_status" NOT NULL DEFAULT 'SAMPLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "package_info" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_role_id" UUID NOT NULL,
    "min_cgpa" DECIMAL(4,2),
    "min_tenth_pct" DECIMAL(5,2),
    "min_twelfth_pct" DECIMAL(5,2),
    "allowed_branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_active_backlogs" INTEGER,
    "max_total_backlogs" INTEGER,
    "graduation_year" INTEGER,
    "extra_conditions" JSONB,

    CONSTRAINT "company_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_required_skills" (
    "job_role_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "importance" "importance" NOT NULL DEFAULT 'MUST',

    CONSTRAINT "company_required_skills_pkey" PRIMARY KEY ("job_role_id","skill_id")
);

-- CreateTable
CREATE TABLE "selection_stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "selection_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_bookmarks" (
    "student_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_bookmarks_pkey" PRIMARY KEY ("student_id","company_id")
);

-- CreateTable
CREATE TABLE "drive_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "job_role_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'Applied',
    "round" TEXT DEFAULT '1. Initial Screening',
    "notes" TEXT DEFAULT '',
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "job_role_id" UUID NOT NULL,
    "status" "eligibility_status" NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_status" "data_status" NOT NULL DEFAULT 'SAMPLE',

    CONSTRAINT "eligibility_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_check_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id" UUID NOT NULL,
    "criterion" TEXT NOT NULL,
    "student_value" TEXT,
    "required_value" TEXT,
    "status" "criterion_status" NOT NULL,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "eligibility_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "coverage_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "job_role_id" UUID NOT NULL,
    "match_score" DECIMAL(5,2) NOT NULL,
    "academic_score" DECIMAL(5,2) NOT NULL,
    "skill_score" DECIMAL(5,2) NOT NULL,
    "branch_score" DECIMAL(5,2) NOT NULL,
    "project_score" DECIMAL(5,2) NOT NULL,
    "cert_score" DECIMAL(5,2) NOT NULL,
    "matching_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missing_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibility" "eligibility_status" NOT NULL,
    "explanation" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "company_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recommendation_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_gap_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "job_role_id" UUID,
    "coverage_pct" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_gap_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_gap_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "status" "skill_gap_status" NOT NULL,
    "priority" "priority" NOT NULL,

    CONSTRAINT "skill_gap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preparation_topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" TEXT NOT NULL,
    "week" INTEGER NOT NULL DEFAULT 1,
    "day_range" TEXT DEFAULT 'Days 1-2',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" "difficulty" NOT NULL DEFAULT 'EASY',
    "estimated_hours" DECIMAL(4,1) NOT NULL DEFAULT 2.0,
    "sequence_order" INTEGER NOT NULL,
    "prerequisite_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "preparation_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "resource_type" NOT NULL,
    "category_label" TEXT DEFAULT 'DSA & Algorithms',
    "read_time" TEXT DEFAULT '10 min read',
    "summary" TEXT,
    "content" TEXT,
    "skill_id" UUID,
    "topic_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "resource_id" UUID,
    "order_no" INTEGER NOT NULL,

    CONSTRAINT "roadmap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "status" "progress_status" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" "question_category" NOT NULL,
    "subtopic" TEXT,
    "pattern_badge" TEXT DEFAULT 'Campus Screening',
    "difficulty" "difficulty" NOT NULL DEFAULT 'EASY',
    "text" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "option_key" TEXT NOT NULL DEFAULT 'A',
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "option_order" INTEGER NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "category" "question_category",
    "num_questions" INTEGER NOT NULL DEFAULT 10,
    "time_limit_sec" INTEGER NOT NULL DEFAULT 600,
    "randomize" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "quiz_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("quiz_id","question_id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "quiz_id" UUID,
    "category" "question_category",
    "status" "attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "question_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_at" TIMESTAMPTZ(6) NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "score" INTEGER,
    "total" INTEGER NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_id" UUID,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_languages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "external_id" INTEGER,

    CONSTRAINT "coding_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_problems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "badge" TEXT DEFAULT 'Campus OA',
    "description" TEXT NOT NULL,
    "difficulty" "difficulty" NOT NULL,
    "topic" TEXT NOT NULL,
    "complexity" TEXT DEFAULT 'O(N)',
    "input_format" TEXT NOT NULL,
    "output_format" TEXT NOT NULL,
    "sample_input" TEXT NOT NULL,
    "sample_output" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "hint" TEXT,
    "java_starter" TEXT DEFAULT '',
    "python_starter" TEXT DEFAULT '',
    "cpp_starter" TEXT DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coding_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_test_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "problem_id" UUID NOT NULL,
    "input" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coding_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "language_id" UUID,
    "source_code" TEXT NOT NULL,
    "status" "submission_status" NOT NULL DEFAULT 'ATTEMPTED',
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "tests_passed" INTEGER,
    "tests_total" INTEGER,
    "result_detail" JSONB,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coding_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "interview_type" NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" "difficulty" NOT NULL DEFAULT 'EASY',
    "question" TEXT NOT NULL,
    "answer_guidance" TEXT NOT NULL,
    "key_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "company_id" UUID,
    "archive_meta" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "type" "interview_type" NOT NULL,
    "question_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "self_rating" INTEGER,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_text" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "self_rating" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "answer_id" UUID NOT NULL,
    "source" "feedback_source" NOT NULL,
    "relevance" INTEGER,
    "structure" INTEGER,
    "completeness" INTEGER,
    "clarity" INTEGER,
    "summary" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improvements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "refined_sample_answer" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" "ai_role" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "overall" DECIMAL(5,2) NOT NULL,
    "academics" DECIMAL(5,2),
    "technical" DECIMAL(5,2),
    "aptitude" DECIMAL(5,2),
    "coding" DECIMAL(5,2),
    "interview" DECIMAL(5,2),
    "projects" DECIMAL(5,2),
    "is_provisional" BOOLEAN NOT NULL DEFAULT false,
    "coverage_pct" INTEGER NOT NULL,
    "missing" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readiness_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "ref_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_badges" (
    "student_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "earned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_badges_pkey" PRIMARY KEY ("student_id","badge_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "announcement_status" NOT NULL DEFAULT 'DRAFT',
    "audience" JSONB NOT NULL,
    "publish_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_recipients" (
    "announcement_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_recipients_pkey" PRIMARY KEY ("announcement_id","student_id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "kind" "bookmark_kind" NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_uid_key" ON "users"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_custodian_code_key" ON "users"("custodian_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_storage_key_key" ON "file_assets"("storage_key");

-- CreateIndex
CREATE INDEX "file_assets_owner_kind_idx" ON "file_assets"("owner_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE INDEX "student_profiles_dept_grad_idx" ON "student_profiles"("department", "graduation_year");

-- CreateIndex
CREATE UNIQUE INDEX "academic_records_student_sem_uq" ON "academic_records"("student_id", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex
CREATE INDEX "projects_student_idx" ON "projects"("student_id");

-- CreateIndex
CREATE INDEX "certifications_student_idx" ON "certifications"("student_id");

-- CreateIndex
CREATE INDEX "internships_student_idx" ON "internships"("student_id");

-- CreateIndex
CREATE INDEX "achievements_student_idx" ON "achievements"("student_id");

-- CreateIndex
CREATE INDEX "resumes_student_idx" ON "resumes"("student_id");

-- CreateIndex
CREATE INDEX "resume_analyses_student_created_idx" ON "resume_analyses"("student_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_industry_idx" ON "companies"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "job_roles_company_title_uq" ON "job_roles"("company_id", "title");

-- CreateIndex
CREATE UNIQUE INDEX "company_requirements_job_role_id_key" ON "company_requirements"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "selection_stages_company_order_uq" ON "selection_stages"("company_id", "stage_order");

-- CreateIndex
CREATE INDEX "drive_applications_student_idx" ON "drive_applications"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "drive_applications_student_comp_uq" ON "drive_applications"("student_id", "company_id");

-- CreateIndex
CREATE INDEX "eligibility_checks_student_idx" ON "eligibility_checks"("student_id", "checked_at");

-- CreateIndex
CREATE INDEX "eligibility_checks_role_status_idx" ON "eligibility_checks"("job_role_id", "status");

-- CreateIndex
CREATE INDEX "eligibility_results_check_idx" ON "eligibility_check_results"("check_id");

-- CreateIndex
CREATE INDEX "recommendation_runs_student_idx" ON "recommendation_runs"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "company_recommendations_run_rank_idx" ON "company_recommendations"("run_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_feedback_uq" ON "recommendation_feedback"("recommendation_id", "student_id");

-- CreateIndex
CREATE INDEX "skill_gap_reports_student_idx" ON "skill_gap_reports"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "skill_gap_items_report_idx" ON "skill_gap_items"("report_id");

-- CreateIndex
CREATE INDEX "skill_gap_items_skill_status_idx" ON "skill_gap_items"("skill_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "preparation_topics_cat_seq_uq" ON "preparation_topics"("category", "sequence_order");

-- CreateIndex
CREATE INDEX "learning_resources_skill_idx" ON "learning_resources"("skill_id");

-- CreateIndex
CREATE INDEX "learning_resources_topic_idx" ON "learning_resources"("topic_id");

-- CreateIndex
CREATE INDEX "roadmap_items_topic_order_idx" ON "roadmap_items"("topic_id", "order_no");

-- CreateIndex
CREATE UNIQUE INDEX "student_progress_student_topic_uq" ON "student_progress"("student_id", "topic_id");

-- CreateIndex
CREATE INDEX "questions_cat_diff_active_idx" ON "questions"("category", "difficulty", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_q_order_uq" ON "question_options"("question_id", "option_order");

-- CreateIndex
CREATE INDEX "quiz_attempts_student_started_idx" ON "quiz_attempts"("student_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_answers_attempt_q_uq" ON "quiz_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "coding_languages_key_key" ON "coding_languages"("key");

-- CreateIndex
CREATE UNIQUE INDEX "coding_problems_slug_key" ON "coding_problems"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "coding_problems_title_key" ON "coding_problems"("title");

-- CreateIndex
CREATE INDEX "coding_problems_topic_diff_idx" ON "coding_problems"("topic", "difficulty");

-- CreateIndex
CREATE INDEX "coding_test_cases_problem_idx" ON "coding_test_cases"("problem_id");

-- CreateIndex
CREATE INDEX "coding_submissions_student_prob_idx" ON "coding_submissions"("student_id", "problem_id");

-- CreateIndex
CREATE INDEX "interview_questions_type_cat_diff_idx" ON "interview_questions"("type", "category", "difficulty");

-- CreateIndex
CREATE INDEX "interview_sessions_student_started_idx" ON "interview_sessions"("student_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "interview_answers_sess_q_uq" ON "interview_answers"("session_id", "question_id");

-- CreateIndex
CREATE INDEX "interview_feedback_answer_idx" ON "interview_feedback"("answer_id");

-- CreateIndex
CREATE INDEX "ai_conversations_student_idx" ON "ai_conversations"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_messages_conv_created_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "readiness_snapshots_student_idx" ON "readiness_snapshots"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "readiness_snapshots_created_idx" ON "readiness_snapshots"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_student_created_idx" ON "learning_activity_logs"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_type_created_idx" ON "learning_activity_logs"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "badges_code_key" ON "badges"("code");

-- CreateIndex
CREATE INDEX "notifications_user_read_created_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "announcements_status_publish_idx" ON "announcements"("status", "publish_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_student_kind_target_uq" ON "bookmarks"("student_id", "kind", "target_id");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_preferences" ADD CONSTRAINT "student_preferences_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_analyses" ADD CONSTRAINT "resume_analyses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_requirements" ADD CONSTRAINT "company_requirements_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_required_skills" ADD CONSTRAINT "company_required_skills_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_required_skills" ADD CONSTRAINT "company_required_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selection_stages" ADD CONSTRAINT "selection_stages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_bookmarks" ADD CONSTRAINT "company_bookmarks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_bookmarks" ADD CONSTRAINT "company_bookmarks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_applications" ADD CONSTRAINT "drive_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_applications" ADD CONSTRAINT "drive_applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_applications" ADD CONSTRAINT "drive_applications_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_checks" ADD CONSTRAINT "eligibility_checks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_checks" ADD CONSTRAINT "eligibility_checks_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_check_results" ADD CONSTRAINT "eligibility_check_results_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "eligibility_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_recommendations" ADD CONSTRAINT "company_recommendations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "recommendation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_recommendations" ADD CONSTRAINT "company_recommendations_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "company_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gap_reports" ADD CONSTRAINT "skill_gap_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gap_reports" ADD CONSTRAINT "skill_gap_reports_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gap_items" ADD CONSTRAINT "skill_gap_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "skill_gap_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gap_items" ADD CONSTRAINT "skill_gap_items_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preparation_topics" ADD CONSTRAINT "preparation_topics_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "preparation_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "preparation_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "preparation_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "preparation_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_test_cases" ADD CONSTRAINT "coding_test_cases_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "coding_problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "coding_problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "coding_languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "interview_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readiness_snapshots" ADD CONSTRAINT "readiness_snapshots_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_activity_logs" ADD CONSTRAINT "learning_activity_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Institutional Domain Integrity Check Constraints (Part C)
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_cgpa_chk" CHECK ("cgpa" IS NULL OR ("cgpa" >= 0 AND "cgpa" <= 10));
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_pct_chk" CHECK (("tenth_pct" IS NULL OR ("tenth_pct" >= 0 AND "tenth_pct" <= 100)) AND ("twelfth_pct" IS NULL OR ("twelfth_pct" >= 0 AND "twelfth_pct" <= 100)) AND ("diploma_pct" IS NULL OR ("diploma_pct" >= 0 AND "diploma_pct" <= 100)));
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_proficiency_chk" CHECK ("proficiency" >= 1 AND "proficiency" <= 5);
