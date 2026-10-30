import { Router } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '../../db/prisma.ts';
import { getCapabilityFlags } from '../config/env.ts';
import { evaluateInterviewAnswerRubric } from '../engines/interviewRubric.ts';
import {
  QUIZ_GRACE_MS,
  sanitizeQuestionsForActiveAttempt,
  scoreQuizAttempt,
  type QuizQuestionForScoring,
} from '../engines/quizScoring.ts';
import { executeInTrustedSandbox } from '../integrations/codeExecution.ts';
import { generateAiInterviewFeedback } from '../integrations/gemini.ts';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { aiRateLimiter, validateBody } from '../middleware/security.ts';
import { evaluateAndPersistStudentReadiness } from '../services/studentDataService.ts';
import { AppError, asyncHandler, sanitizeDbError } from '../utils/errors.ts';
import { buildPaginationMeta, parsePagination, sendSuccess } from '../utils/response.ts';

export const practiceRouter = Router();

const QUESTION_CATEGORIES = [
  'QUANT',
  'LOGICAL',
  'VERBAL',
  'NUMBER_SYSTEMS',
  'PERCENTAGES',
  'PROFIT_LOSS',
  'TIME_WORK',
  'TSD',
  'PROBABILITY',
  'PERM_COMB',
  'CODING_DECODING',
  'SERIES',
  'PUZZLES',
] as const;

const createAttemptSchema = z.object({
  quizId: z.string().uuid().optional(),
  category: z.preprocess(
    (v) => (typeof v === 'string' && v.trim().toUpperCase() === 'QUANTITATIVE' ? 'QUANT' : v),
    z.enum(QUESTION_CATEGORIES).optional()
  ),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  numQuestions: z.coerce.number().int().min(1).max(40).default(10),
  timeLimitSec: z.coerce.number().int().min(30).max(7200).default(600),
});

const autosaveAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        optionId: z.string().uuid().nullable().optional(),
      })
    )
    .max(50),
});

const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        optionId: z.string().uuid().nullable().optional(),
      })
    )
    .max(50)
    .optional(),
  // Intentionally allow unknown `score` key in body so we can prove server ignores client score!
  score: z.unknown().optional(),
});

const codingSubmissionSchema = z.object({
  languageId: z.string().uuid().optional(),
  languageKey: z.string().trim().max(40).optional(),
  sourceCode: z.string().min(1).max(64_000),
  selfMarkSolved: z.boolean().optional(),
});

const updateSubmissionStatusSchema = z.object({
  status: z.enum(['ATTEMPTED', 'SELF_MARKED_SOLVED']),
});

const createInterviewSessionSchema = z.object({
  type: z.enum(['TECHNICAL', 'HR', 'PROJECT', 'COMPANY']),
  count: z.coerce.number().int().min(1).max(15).default(5),
  companyId: z.string().uuid().optional(),
});

const saveInterviewAnswerSchema = z.object({
  answerText: z.string().trim().max(3000).optional(),
  selfRating: z.coerce.number().int().min(1).max(5).optional(),
  reviewed: z.boolean().optional(),
});

const completeInterviewSessionSchema = z.object({
  selfRating: z.coerce.number().int().min(1).max(5).optional(),
});

const requestInterviewFeedbackSchema = z.object({
  useAi: z.boolean().default(false),
});

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadQuestionsWithOptions(questionIds: string[]) {
  if (questionIds.length === 0) return [];
  const qRows = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: {
      options: {
        orderBy: { optionOrder: 'asc' },
      },
    },
  });

  const qById = new Map(qRows.map((q) => [q.id, q]));
  return questionIds
    .map((id) => qById.get(id))
    .filter((q): q is (typeof qRows)[number] => Boolean(q));
}

// ============================================================================
// APTITUDE QUIZZES & SERVER-SCORED TIMED ATTEMPTS (Part F8 & H6)
// ============================================================================
practiceRouter.get(
  '/aptitude/categories',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [allQuestions, attempts] = await Promise.all([
      prisma.question.findMany({ where: { isActive: true } }),
      prisma.quizAttempt.findMany({ where: { studentId } }),
    ]);

    const countByCat = new Map<string, number>();
    for (const q of allQuestions) {
      countByCat.set(q.category, (countByCat.get(q.category) || 0) + 1);
    }

    const attemptsByCat = new Map<string, { count: number; totalPct: number }>();
    for (const a of attempts) {
      if ((a.status === 'SUBMITTED' || a.status === 'EXPIRED') && a.total > 0 && a.score !== null) {
        const key = a.category || 'MIXED';
        const cur = attemptsByCat.get(key) || { count: 0, totalPct: 0 };
        cur.count += 1;
        cur.totalPct += (a.score / a.total) * 100;
        attemptsByCat.set(key, cur);
      }
    }

    const categories = QUESTION_CATEGORIES.map((cat) => {
      const stat = attemptsByCat.get(cat);
      return {
        category: cat,
        questionCount: countByCat.get(cat) || 0,
        attemptsCount: stat?.count || 0,
        averageAccuracyPct: stat && stat.count > 0 ? Math.round(stat.totalPct / stat.count) : null,
      };
    });

    return sendSuccess(res, categories);
  })
);

practiceRouter.get(
  '/aptitude/quizzes',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.quiz.findMany({ where: { isActive: true } });
    return sendSuccess(res, rows);
  })
);

practiceRouter.post(
  '/aptitude/attempts',
  authenticate,
  requireRole('STUDENT'),
  validateBody(createAttemptSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const { quizId, category, difficulty, numQuestions, timeLimitSec } = req.body;

    try {
      let chosenIds: string[] = [];
      let effectiveTimeLimit = timeLimitSec;
      let effectiveCategory = category ?? null;

      if (quizId) {
        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
        if (!quiz || !quiz.isActive) {
          throw new AppError(404, 'QUIZ_NOT_FOUND', 'Selected quiz not found.');
        }
        effectiveTimeLimit = quiz.timeLimitSec;
        effectiveCategory = quiz.category ?? effectiveCategory;
        const linked = await prisma.quizQuestion.findMany({
          where: { quizId: quiz.id },
          orderBy: { position: 'asc' },
        });
        chosenIds = linked.map((l) => l.questionId);
      }

      if (chosenIds.length === 0) {
        const activeQs = await prisma.question.findMany({ where: { isActive: true } });
        const matching = activeQs.filter((q) => {
          if (effectiveCategory && q.category !== effectiveCategory) return false;
          if (difficulty && q.difficulty !== difficulty) return false;
          return true;
        });

        // Shuffle deterministically-safe via Fisher-Yates
        const pool = [...matching];
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        chosenIds = pool.slice(0, numQuestions).map((q) => q.id);
      }

      if (chosenIds.length === 0) {
        throw new AppError(
          404,
          'NO_QUESTIONS_AVAILABLE',
          'No active aptitude questions match the requested criteria.'
        );
      }

      const startedAt = new Date();
      const deadlineAt = new Date(startedAt.getTime() + effectiveTimeLimit * 1000);

      const attempt = await prisma.quizAttempt.create({
        data: {
          studentId,
          quizId: quizId ?? null,
          category: effectiveCategory,
          status: 'IN_PROGRESS',
          questionIds: chosenIds,
          startedAt,
          deadlineAt,
          total: chosenIds.length,
        },
      });

      const fullQuestions = await loadQuestionsWithOptions(chosenIds);
      // CRITICAL: Never expose `isCorrect` or `explanation` while attempt is IN_PROGRESS!
      const sanitizedQuestions = sanitizeQuestionsForActiveAttempt(fullQuestions);

      return sendSuccess(
        res,
        {
          attempt: {
            id: attempt.id,
            status: attempt.status,
            category: attempt.category,
            startedAt: attempt.startedAt,
            deadlineAt: attempt.deadlineAt,
            total: attempt.total,
          },
          questions: sanitizedQuestions,
        },
        'Quiz attempt started',
        201
      );
    } catch (err) {
      sanitizeDbError('aptitude.createAttempt', err);
    }
  })
);

practiceRouter.put(
  '/aptitude/attempts/:id/answers',
  authenticate,
  requireRole('STUDENT'),
  validateBody(autosaveAnswersSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const attemptId = String(req.params.id);
    if (!UUID_REGEX.test(attemptId)) {
      throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Quiz attempt not found.');
    }

    const attempt = await prisma.quizAttempt.findFirst({
      where: { id: attemptId, studentId },
    });

    if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Quiz attempt not found.');
    if (attempt.status !== 'IN_PROGRESS') {
      throw new AppError(409, 'ATTEMPT_CLOSED', 'Quiz attempt is already finalized.');
    }
    if (Date.now() > attempt.deadlineAt.getTime() + QUIZ_GRACE_MS) {
      throw new AppError(409, 'ATTEMPT_EXPIRED', 'Quiz deadline has passed.');
    }

    const allowedQuestionSet = new Set(attempt.questionIds);
    for (const ans of req.body.answers) {
      if (!allowedQuestionSet.has(ans.questionId)) continue;
      await prisma.quizAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: ans.questionId,
          },
        },
        create: {
          attemptId,
          questionId: ans.questionId,
          selectedOptionId: ans.optionId ?? null,
          isCorrect: false,
        },
        update: {
          selectedOptionId: ans.optionId ?? null,
        },
      });
    }

    return sendSuccess(res, { savedCount: req.body.answers.length }, 'Answers autosaved');
  })
);

practiceRouter.post(
  '/aptitude/attempts/:id/submit',
  authenticate,
  requireRole('STUDENT'),
  validateBody(submitAttemptSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const attemptId = String(req.params.id);
    if (!UUID_REGEX.test(attemptId)) {
      throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Quiz attempt not found.');
    }

    try {
      const attempt = await prisma.quizAttempt.findFirst({
        where: { id: attemptId, studentId },
      });

      if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Quiz attempt not found.');
      if (attempt.status !== 'IN_PROGRESS') {
        throw new AppError(
          409,
          'ALREADY_SUBMITTED',
          'This quiz attempt has already been submitted.'
        );
      }

      const [fullQuestions, existingAutosaved] = await Promise.all([
        loadQuestionsWithOptions(attempt.questionIds),
        prisma.quizAnswer.findMany({ where: { attemptId } }),
      ]);

      const questionsMap = new Map<string, QuizQuestionForScoring>();
      for (const q of fullQuestions) {
        questionsMap.set(q.id, {
          id: q.id,
          explanation: q.explanation,
          options: q.options.map((o) => ({
            id: o.id,
            optionKey: o.optionKey,
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        });
      }

      const autosavedInput = existingAutosaved.map((a) => ({
        questionId: a.questionId,
        optionId: a.selectedOptionId,
      }));
      const submittedInput = Array.isArray(req.body.answers) ? req.body.answers : autosavedInput;

      const now = new Date();
      const scored = scoreQuizAttempt({
        questionIds: attempt.questionIds,
        questionsById: questionsMap,
        submittedAnswers: submittedInput,
        autosavedAnswers: autosavedInput,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        now,
      });

      await prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: scored.status,
          score: scored.score,
          submittedAt: now,
        },
      });

      for (const item of scored.results) {
        await prisma.quizAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId,
              questionId: item.questionId,
            },
          },
          create: {
            attemptId,
            questionId: item.questionId,
            selectedOptionId: item.selectedOptionId,
            isCorrect: item.isCorrect,
          },
          update: {
            selectedOptionId: item.selectedOptionId,
            isCorrect: item.isCorrect,
          },
        });
      }

      await prisma.learningActivityLog.create({
        data: {
          studentId,
          type: 'QUIZ_SUBMITTED',
          refId: attemptId,
          metadata: {
            score: scored.score,
            total: scored.total,
            category: attempt.category,
            status: scored.status,
          } as Prisma.InputJsonValue,
        },
      });

      await prisma.notification.create({
        data: {
          userId: req.auth!.userId,
          type: 'PREPARATION',
          title: `Quiz Completed: ${scored.score}/${scored.total}`,
          body: `Your ${attempt.category || 'Aptitude'} attempt was scored (${Math.round(
            (scored.score / Math.max(1, scored.total)) * 100
          )}%). Review explanations to reinforce weak concepts.`,
        },
      });

      await evaluateAndPersistStudentReadiness(studentId, true);

      return sendSuccess(res, {
        attemptId,
        status: scored.status,
        score: scored.score,
        total: scored.total,
        accuracyPct: Math.round((scored.score / Math.max(1, scored.total)) * 100),
        skippedCount: scored.skippedCount,
        late: scored.late,
        durationSec: scored.durationSec,
        results: scored.results,
      });
    } catch (err) {
      sanitizeDbError('aptitude.submitAttempt', err);
    }
  })
);

practiceRouter.get(
  '/aptitude/attempts',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 20, 100);
    const rows = await prisma.quizAttempt.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: { startedAt: 'desc' },
    });

    const total = rows.length;
    const paged = rows.slice(offset, offset + pageSize);
    return sendSuccess(
      res,
      paged,
      'Quiz attempts retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

practiceRouter.get(
  '/aptitude/attempts/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const attemptId = String(req.params.id);
    if (!UUID_REGEX.test(attemptId)) {
      throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Quiz attempt not found.');
    }

    const attempt = await prisma.quizAttempt.findFirst({
      where: { id: attemptId, studentId },
    });

    if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Quiz attempt not found.');

    const [fullQuestions, savedAnswers] = await Promise.all([
      loadQuestionsWithOptions(attempt.questionIds),
      prisma.quizAnswer.findMany({ where: { attemptId } }),
    ]);

    // CRITICAL: If still IN_PROGRESS, NEVER leak `isCorrect` or `explanation`!
    if (attempt.status === 'IN_PROGRESS') {
      const answerMap = new Map(savedAnswers.map((a) => [a.questionId, a.selectedOptionId]));
      return sendSuccess(res, {
        attempt,
        questions: sanitizeQuestionsForActiveAttempt(fullQuestions),
        savedAnswers: Object.fromEntries(answerMap.entries()),
      });
    }

    const answerByQ = new Map(savedAnswers.map((a) => [a.questionId, a]));
    return sendSuccess(res, {
      attempt,
      questions: fullQuestions.map((q) => {
        const ans = answerByQ.get(q.id);
        return {
          id: q.id,
          category: q.category,
          subtopic: q.subtopic,
          difficulty: q.difficulty,
          text: q.text,
          explanation: q.explanation,
          selectedOptionId: ans?.selectedOptionId ?? null,
          isCorrect: ans?.isCorrect ?? false,
          options: q.options,
        };
      }),
    });
  })
);

practiceRouter.get(
  '/aptitude/performance',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.quizAttempt.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: { startedAt: 'asc' },
    });

    const completed = rows.filter(
      (r) => (r.status === 'SUBMITTED' || r.status === 'EXPIRED') && r.total > 0 && r.score !== null
    );
    const byCategory: Record<string, { attempts: number; avgPct: number; bestPct: number }> = {};

    for (const r of completed) {
      const cat = r.category || 'MIXED';
      const pct = Math.round(((r.score ?? 0) / r.total) * 100);
      if (!byCategory[cat]) {
        byCategory[cat] = { attempts: 1, avgPct: pct, bestPct: pct };
      } else {
        const prev = byCategory[cat];
        const totalSum = prev.avgPct * prev.attempts + pct;
        prev.attempts += 1;
        prev.avgPct = Math.round(totalSum / prev.attempts);
        prev.bestPct = Math.max(prev.bestPct, pct);
      }
    }

    return sendSuccess(res, {
      totalCompletedAttempts: completed.length,
      byCategory,
      recentTrend: completed.slice(-10).map((r) => ({
        attemptId: r.id,
        category: r.category,
        pct: Math.round(((r.score ?? 0) / r.total) * 100),
        submittedAt: r.submittedAt,
      })),
    });
  })
);

// ============================================================================
// CODING PRACTICE MODULE (Part F9 & Part A Section 7 — No Server Execution!)
// ============================================================================
practiceRouter.get(
  '/coding/problems',
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 30, 100);
    const topicFilter =
      typeof req.query.topic === 'string' ? req.query.topic.trim().toLowerCase() : '';
    const diffFilter =
      typeof req.query.difficulty === 'string' ? req.query.difficulty.trim().toUpperCase() : '';
    const statusFilter =
      typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const probs = await prisma.codingProblem.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    });

    const studentId = req.auth?.role === 'STUDENT' ? req.auth.studentId : undefined;
    const subRows = studentId
      ? await prisma.codingSubmission.findMany({
          where: { studentId },
          orderBy: { submittedAt: 'desc' },
        })
      : [];

    const statusByProb = new Map<string, string>();
    for (const s of subRows) {
      const cur = statusByProb.get(s.problemId);
      if (!cur || s.status === 'PASSED' || s.status === 'SELF_MARKED_SOLVED') {
        statusByProb.set(s.problemId, s.status);
      }
    }

    const { executionEnabled } = getCapabilityFlags();

    const filtered = probs
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        badge: p.badge,
        difficulty: p.difficulty,
        topic: p.topic,
        complexity: p.complexity,
        studentStatus: statusByProb.get(p.id) || 'UNSOLVED',
        isSolved:
          statusByProb.get(p.id) === 'PASSED' || statusByProb.get(p.id) === 'SELF_MARKED_SOLVED',
      }))
      .filter((p) => {
        if (topicFilter && !p.topic.toLowerCase().includes(topicFilter)) return false;
        if (diffFilter && p.difficulty !== diffFilter) return false;
        if (statusFilter === 'SOLVED' && !p.isSolved) return false;
        if (statusFilter === 'UNSOLVED' && p.isSolved) return false;
        if (q && !`${p.title} ${p.topic}`.toLowerCase().includes(q)) return false;
        return true;
      });

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + pageSize);

    return sendSuccess(
      res,
      {
        executionEnabled,
        mode: executionEnabled ? 'SANDBOX' : 'PRACTICE',
        problems: paged,
      },
      'Coding problems retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

practiceRouter.get(
  '/coding/problems/:id',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const idOrSlug = String(req.params.id);
    const isUuid = UUID_REGEX.test(idOrSlug);
    const prob = await prisma.codingProblem.findFirst({
      where: isUuid
        ? { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
        : { slug: idOrSlug },
    });

    if (!prob || !prob.isActive) {
      throw new AppError(404, 'PROBLEM_NOT_FOUND', 'Coding problem not found.');
    }

    // CRITICAL SECURITY RULE: Return ONLY sample test cases (`isHidden = false`) — NEVER hidden test cases!
    const [sampleTests, langs] = await Promise.all([
      prisma.codingTestCase.findMany({
        where: { problemId: prob.id, isHidden: false },
        select: {
          id: true,
          input: true,
          expectedOutput: true,
        },
      }),
      prisma.codingLanguage.findMany({ where: { isEnabled: true } }),
    ]);

    const { executionEnabled } = getCapabilityFlags();

    return sendSuccess(res, {
      problem: prob,
      sampleTestCases: sampleTests,
      languages: langs,
      executionEnabled,
      mode: executionEnabled ? 'SANDBOX' : 'PRACTICE',
    });
  })
);

practiceRouter.post(
  '/coding/problems/:id/submissions',
  authenticate,
  requireRole('STUDENT'),
  validateBody(codingSubmissionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const idOrSlug = String(req.params.id);
    const isUuid = UUID_REGEX.test(idOrSlug);

    const prob = await prisma.codingProblem.findFirst({
      where: isUuid
        ? { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
        : { slug: idOrSlug },
    });
    if (!prob) throw new AppError(404, 'PROBLEM_NOT_FOUND', 'Coding problem not found.');

    const langs = await prisma.codingLanguage.findMany();
    const matchedLang = req.body.languageId
      ? langs.find((l) => l.id === req.body.languageId)
      : req.body.languageKey
      ? langs.find((l) => l.key.toLowerCase() === req.body.languageKey.toLowerCase())
      : langs[0];

    const { executionEnabled } = getCapabilityFlags();

    let status: 'ATTEMPTED' | 'SELF_MARKED_SOLVED' | 'PASSED' | 'FAILED' | 'ERROR' =
      req.body.selfMarkSolved ? 'SELF_MARKED_SOLVED' : 'ATTEMPTED';
    let executed = false;
    let testsPassed: number | null = null;
    let testsTotal: number | null = null;
    let resultDetail: Record<string, unknown> = {
      mode: 'PRACTICE',
      note: 'Code saved in practice mode. External execution sandbox is disabled.',
    };

    if (executionEnabled) {
      const allTests = await prisma.codingTestCase.findMany({
        where: { problemId: prob.id },
      });
      let passCount = 0;
      let anyError = false;
      const publicCaseFeedback: Record<string, unknown>[] = [];

      for (const tc of allTests) {
        const run = await executeInTrustedSandbox({
          languageKey: matchedLang?.key || 'python',
          externalLanguageId: matchedLang?.externalId,
          sourceCode: req.body.sourceCode,
          stdin: tc.input,
        });
        executed = executed || run.executed;
        const matchedOut = run.stdout.trim() === tc.expectedOutput.trim();
        if (run.status === 'ERROR') anyError = true;
        if (run.executed && matchedOut) passCount++;

        // NEVER leak hidden test case inputs or expected outputs!
        publicCaseFeedback.push(
          tc.isHidden
            ? { hidden: true, passed: run.executed && matchedOut }
            : {
                hidden: false,
                passed: run.executed && matchedOut,
                actualOutput: run.stdout.slice(0, 500),
              }
        );
      }

      testsTotal = allTests.length;
      testsPassed = passCount;
      status = anyError ? 'ERROR' : passCount === allTests.length ? 'PASSED' : 'FAILED';
      resultDetail = { mode: 'SANDBOX', cases: publicCaseFeedback };
    }

    const saved = await prisma.codingSubmission.create({
      data: {
        studentId,
        problemId: prob.id,
        languageId: matchedLang?.id ?? null,
        sourceCode: req.body.sourceCode,
        status,
        executed,
        testsPassed,
        testsTotal,
        resultDetail: resultDetail as Prisma.InputJsonValue,
      },
    });

    await prisma.learningActivityLog.create({
      data: {
        studentId,
        type: 'CODE_SUBMITTED',
        refId: saved.id,
        metadata: {
          problemId: prob.id,
          title: prob.title,
          status,
          executed,
        } as Prisma.InputJsonValue,
      },
    });

    await evaluateAndPersistStudentReadiness(studentId, true);

    return sendSuccess(
      res,
      {
        submission: saved,
        executed,
        executionEnabled,
        mode: executionEnabled ? 'SANDBOX' : 'PRACTICE',
      },
      executionEnabled
        ? 'Submission evaluated in external sandbox'
        : 'Submission saved in practice mode',
      201
    );
  })
);

practiceRouter.put(
  '/coding/submissions/:id/status',
  authenticate,
  requireRole('STUDENT'),
  validateBody(updateSubmissionStatusSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { executionEnabled } = getCapabilityFlags();
    if (executionEnabled) {
      throw new AppError(
        400,
        'SELF_MARK_DISABLED',
        'Self-marking status is disabled when automated sandbox execution is active.'
      );
    }

    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Coding submission not found.');
    }

    const existing = await prisma.codingSubmission.findFirst({
      where: { id, studentId },
    });
    if (!existing) throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Coding submission not found.');

    const updated = await prisma.codingSubmission.update({
      where: { id },
      data: { status: req.body.status },
    });

    await evaluateAndPersistStudentReadiness(studentId, true);
    return sendSuccess(res, updated, 'Practice status updated');
  })
);

practiceRouter.get(
  '/coding/submissions',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const problemFilter =
      typeof req.query.problemId === 'string' ? req.query.problemId.trim() : '';

    const rawRows = await prisma.codingSubmission.findMany({
      where: { studentId: req.auth!.studentId! },
      include: {
        problem: {
          select: {
            title: true,
            slug: true,
            difficulty: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const rows = rawRows.map((r) => ({
      id: r.id,
      problemId: r.problemId,
      problemTitle: r.problem.title,
      problemSlug: r.problem.slug,
      difficulty: r.problem.difficulty,
      languageId: r.languageId,
      status: r.status,
      executed: r.executed,
      testsPassed: r.testsPassed,
      testsTotal: r.testsTotal,
      submittedAt: r.submittedAt,
    }));

    const filtered = problemFilter ? rows.filter((r) => r.problemId === problemFilter) : rows;
    return sendSuccess(res, filtered);
  })
);

practiceRouter.get(
  '/coding/performance',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [probs, subs] = await Promise.all([
      prisma.codingProblem.findMany({ where: { isActive: true } }),
      prisma.codingSubmission.findMany({ where: { studentId } }),
    ]);

    const solvedSet = new Set(
      subs
        .filter((s) => s.status === 'PASSED' || s.status === 'SELF_MARKED_SOLVED')
        .map((s) => s.problemId)
    );

    const byDifficulty = {
      EASY: { solved: 0, total: 0 },
      MEDIUM: { solved: 0, total: 0 },
      HARD: { solved: 0, total: 0 },
    };
    const byTopic: Record<string, { solved: number; total: number }> = {};

    for (const p of probs) {
      byDifficulty[p.difficulty].total += 1;
      if (!byTopic[p.topic]) byTopic[p.topic] = { solved: 0, total: 0 };
      byTopic[p.topic].total += 1;
      if (solvedSet.has(p.id)) {
        byDifficulty[p.difficulty].solved += 1;
        byTopic[p.topic].solved += 1;
      }
    }

    return sendSuccess(res, {
      totalSubmissions: subs.length,
      solvedCount: solvedSet.size,
      totalProblems: probs.length,
      byDifficulty,
      byTopic,
    });
  })
);

// ============================================================================
// INTERVIEW PREPARATION & RUBRIC / AI FEEDBACK (Part F10)
// ============================================================================
practiceRouter.get(
  '/interview/questions',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 30, 100);
    const typeFilter =
      typeof req.query.type === 'string' ? req.query.type.trim().toUpperCase() : '';
    const categoryFilter =
      typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    const diffFilter =
      typeof req.query.difficulty === 'string' ? req.query.difficulty.trim().toUpperCase() : '';
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : '';

    const rows = await prisma.interviewQuestion.findMany({
      where: { isActive: true },
    });

    const filtered = rows.filter((q) => {
      if (typeFilter && q.type !== typeFilter) return false;
      if (categoryFilter && !q.category.toLowerCase().includes(categoryFilter)) return false;
      if (diffFilter && q.difficulty !== diffFilter) return false;
      if (companyId && q.companyId !== companyId) return false;
      return true;
    });

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + pageSize);
    return sendSuccess(
      res,
      paged,
      'Interview questions retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

practiceRouter.get(
  '/interview/questions/:id',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'INTERVIEW_QUESTION_NOT_FOUND', 'Interview question not found.');
    }
    const row = await prisma.interviewQuestion.findUnique({ where: { id } });
    if (!row || !row.isActive) {
      throw new AppError(404, 'INTERVIEW_QUESTION_NOT_FOUND', 'Interview question not found.');
    }
    return sendSuccess(res, row);
  })
);

practiceRouter.post(
  '/interview/sessions',
  authenticate,
  requireRole('STUDENT'),
  validateBody(createInterviewSessionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const { type, count, companyId } = req.body;

    const allQs = await prisma.interviewQuestion.findMany({
      where: { isActive: true, type },
    });

    const filtered = companyId ? allQs.filter((q) => q.companyId === companyId) : allQs;
    const pool = [...(filtered.length > 0 ? filtered : allQs)];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = pool.slice(0, count);
    if (chosen.length === 0) {
      throw new AppError(404, 'NO_INTERVIEW_QUESTIONS', 'No active interview questions available.');
    }

    const session = await prisma.interviewSession.create({
      data: {
        studentId,
        type,
        questionIds: chosen.map((q) => q.id),
      },
    });

    return sendSuccess(
      res,
      {
        session,
        questions: chosen.map((q) => ({
          id: q.id,
          type: q.type,
          category: q.category,
          difficulty: q.difficulty,
          question: q.question,
        })),
      },
      'Mock interview session started',
      201
    );
  })
);

practiceRouter.put(
  '/interview/sessions/:id/answers/:questionId',
  authenticate,
  requireRole('STUDENT'),
  validateBody(saveInterviewAnswerSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const sessionId = String(req.params.id);
    const questionId = String(req.params.questionId);
    if (!UUID_REGEX.test(sessionId) || !UUID_REGEX.test(questionId)) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Interview session or question not found.');
    }

    const sess = await prisma.interviewSession.findFirst({
      where: { id: sessionId, studentId },
    });
    if (!sess) throw new AppError(404, 'SESSION_NOT_FOUND', 'Interview session not found.');

    const saved = await prisma.interviewAnswer.upsert({
      where: {
        sessionId_questionId: {
          sessionId,
          questionId,
        },
      },
      create: {
        sessionId,
        questionId,
        answerText: req.body.answerText ?? null,
        selfRating: req.body.selfRating ?? null,
        reviewed: req.body.reviewed ?? true,
      },
      update: {
        ...(req.body.answerText !== undefined ? { answerText: req.body.answerText } : {}),
        ...(req.body.selfRating !== undefined ? { selfRating: req.body.selfRating } : {}),
        reviewed: req.body.reviewed ?? true,
      },
    });

    return sendSuccess(res, saved, 'Interview answer saved');
  })
);

practiceRouter.post(
  '/interview/sessions/:id/complete',
  authenticate,
  requireRole('STUDENT'),
  validateBody(completeInterviewSessionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const sessionId = String(req.params.id);
    if (!UUID_REGEX.test(sessionId)) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Interview session not found.');
    }

    const existing = await prisma.interviewSession.findFirst({
      where: { id: sessionId, studentId },
    });
    if (!existing) throw new AppError(404, 'SESSION_NOT_FOUND', 'Interview session not found.');

    const updated = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        completedAt: new Date(),
        ...(req.body.selfRating !== undefined ? { selfRating: req.body.selfRating } : {}),
      },
    });

    await prisma.learningActivityLog.create({
      data: {
        studentId,
        type: 'INTERVIEW_COMPLETED',
        refId: sessionId,
        metadata: { type: updated.type } as Prisma.InputJsonValue,
      },
    });

    await evaluateAndPersistStudentReadiness(studentId, true);

    return sendSuccess(res, updated, 'Interview session completed');
  })
);

practiceRouter.post(
  '/interview/answers/:id/feedback',
  authenticate,
  requireRole('STUDENT'),
  aiRateLimiter,
  validateBody(requestInterviewFeedbackSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const answerId = String(req.params.id);
    if (!UUID_REGEX.test(answerId)) {
      throw new AppError(404, 'ANSWER_NOT_FOUND', 'Interview answer not found.');
    }

    const ans = await prisma.interviewAnswer.findUnique({
      where: { id: answerId },
    });
    if (!ans) throw new AppError(404, 'ANSWER_NOT_FOUND', 'Interview answer not found.');

    const sess = await prisma.interviewSession.findFirst({
      where: { id: ans.sessionId, studentId },
    });
    if (!sess) throw new AppError(403, 'FORBIDDEN', 'Cannot evaluate another student answer.');

    const qRow = await prisma.interviewQuestion.findUnique({
      where: { id: ans.questionId },
    });
    if (!qRow) throw new AppError(404, 'QUESTION_NOT_FOUND', 'Question not found.');

    // Always compute deterministic text rubric first
    const rubric = evaluateInterviewAnswerRubric({
      question: qRow.question,
      answerGuidance: qRow.answerGuidance,
      keyPoints: qRow.keyPoints || [],
      answerText: ans.answerText || '',
      interviewType: qRow.type,
    });

    const { aiEnabled } = getCapabilityFlags();
    let finalEval = rubric;
    let fallbackNote: string | undefined;

    if (req.body.useAi && aiEnabled && (ans.answerText || '').trim().length >= 10) {
      try {
        const aiOut = await generateAiInterviewFeedback({
          question: qRow.question,
          answerGuidance: qRow.answerGuidance,
          keyPoints: qRow.keyPoints || [],
          studentAnswer: ans.answerText || '',
          studentNameToRedact: req.auth!.fullName,
        });
        finalEval = {
          source: 'AI',
          relevance: aiOut.relevance,
          structure: aiOut.structure,
          completeness: aiOut.completeness,
          clarity: aiOut.clarity,
          overallScore100: Math.round(
            ((aiOut.relevance + aiOut.structure + aiOut.completeness + aiOut.clarity) / 20) * 100
          ),
          summary: aiOut.summary,
          strengths: aiOut.strengths,
          improvements: aiOut.improvements,
          refinedSampleAnswer: aiOut.refinedSampleAnswer || qRow.answerGuidance,
        };
      } catch {
        // Part I Fallback Rule: Automatically fall back to deterministic RUBRIC when AI fails
        fallbackNote = 'AI evaluation unavailable; deterministic rubric evaluation returned.';
      }
    }

    const savedFeedback = await prisma.interviewFeedback.create({
      data: {
        answerId: ans.id,
        source: finalEval.source,
        relevance: finalEval.relevance,
        structure: finalEval.structure,
        completeness: finalEval.completeness,
        clarity: finalEval.clarity,
        summary: finalEval.summary,
        strengths: finalEval.strengths,
        improvements: finalEval.improvements,
        refinedSampleAnswer: finalEval.refinedSampleAnswer,
      },
    });

    return sendSuccess(res, {
      feedback: savedFeedback,
      overallScore100: finalEval.overallScore100,
      source: finalEval.source,
      ...(fallbackNote ? { fallbackNote } : {}),
    });
  })
);

practiceRouter.get(
  '/interview/history',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const sessions = await prisma.interviewSession.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: { startedAt: 'desc' },
    });
    return sendSuccess(res, sessions);
  })
);
