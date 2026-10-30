export interface QuizQuestionForScoring {
  id: string;
  explanation: string;
  options: { id: string; optionKey?: string; text: string; isCorrect: boolean }[];
}

export interface SubmittedQuizAnswerInput {
  questionId: string;
  optionId?: string | null;
}

export interface ScoredQuestionResult {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string | null;
  isCorrect: boolean;
  skipped: boolean;
  explanation: string;
}

export interface QuizScoringOutcome {
  status: 'SUBMITTED' | 'EXPIRED';
  score: number;
  total: number;
  skippedCount: number;
  late: boolean;
  durationSec: number;
  results: ScoredQuestionResult[];
}

export const QUIZ_GRACE_MS = 10_000; // 10 seconds server-side grace window per Part H6

/**
 * Strips `isCorrect` and `explanation` before sending an active attempt to a student.
 */
export function sanitizeQuestionsForActiveAttempt<
  T extends {
    id: string;
    category: string;
    subtopic?: string | null;
    patternBadge?: string | null;
    difficulty: string;
    text: string;
    options: { id: string; optionKey?: string; text: string; optionOrder: number; isCorrect?: boolean }[];
  }
>(questions: T[]) {
  return questions.map((q) => ({
    id: q.id,
    category: q.category,
    subtopic: q.subtopic ?? null,
    patternBadge: q.patternBadge ?? 'Campus Screening',
    difficulty: q.difficulty,
    text: q.text,
    options: q.options.map((opt) => ({
      id: opt.id,
      optionKey: opt.optionKey ?? 'A',
      text: opt.text,
      optionOrder: opt.optionOrder,
    })),
  }));
}

/**
 * Part H6 — Timed Quiz Server-Side Scoring Engine
 * - Ignores any client-supplied score.
 * - Allows up to 10s grace past deadlineAt (`late = true`).
 * - Past deadlineAt + 10s -> marks `EXPIRED` and scores ONLY `autosavedAnswers` saved before deadline!
 */
export function scoreQuizAttempt(params: {
  questionIds: string[];
  questionsById: Map<string, QuizQuestionForScoring>;
  submittedAnswers: SubmittedQuizAnswerInput[];
  autosavedAnswers?: SubmittedQuizAnswerInput[];
  startedAt: Date;
  deadlineAt: Date;
  now?: Date;
}): QuizScoringOutcome {
  const now = params.now ?? new Date();
  const elapsedMs = Math.max(0, now.getTime() - params.startedAt.getTime());
  const durationSec = Math.round(elapsedMs / 1000);

  const msPastDeadline = now.getTime() - params.deadlineAt.getTime();
  const isExpired = msPastDeadline > QUIZ_GRACE_MS;
  const late = msPastDeadline > 0 && !isExpired;

  // When expired past grace, score ONLY answers autosaved before expiry
  const effectiveAnswers = isExpired ? params.autosavedAnswers ?? [] : params.submittedAnswers;
  const answerMap = new Map<string, string | null>();
  for (const ans of effectiveAnswers) {
    if (ans && ans.questionId) {
      answerMap.set(ans.questionId, ans.optionId ?? null);
    }
  }

  let score = 0;
  let skippedCount = 0;
  const results: ScoredQuestionResult[] = [];

  for (const qId of params.questionIds) {
    const q = params.questionsById.get(qId);
    if (!q) continue;
    const correctOpt = q.options.find((o) => o.isCorrect) ?? null;
    const selectedOptionId = answerMap.get(qId) ?? null;
    const skipped = !selectedOptionId;
    if (skipped) skippedCount++;

    const isCorrect = Boolean(
      selectedOptionId && correctOpt && selectedOptionId === correctOpt.id
    );
    if (isCorrect) score++;

    results.push({
      questionId: qId,
      selectedOptionId,
      correctOptionId: correctOpt?.id ?? null,
      isCorrect,
      skipped,
      explanation: q.explanation,
    });
  }

  return {
    status: isExpired ? 'EXPIRED' : 'SUBMITTED',
    score,
    total: params.questionIds.length,
    skippedCount,
    late,
    durationSec,
    results,
  };
}
