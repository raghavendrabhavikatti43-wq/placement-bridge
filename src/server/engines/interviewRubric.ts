export interface RubricEvaluationResult {
  source: 'RUBRIC' | 'AI';
  relevance: number; // 0..5
  structure: number; // 0..5
  completeness: number; // 0..5
  clarity: number; // 0..5
  overallScore100: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  refinedSampleAnswer: string;
}

/**
 * Part I — Deterministic Interview Answer Rubric Evaluator (Text-Only)
 * Scores relevance, structure, completeness, and clarity (0..5 each) from keyPoints coverage,
 * structural markers (trade-offs, complexity, STAR sequence), and answer conciseness.
 * Never claims tone, speech, or facial analysis.
 */
export function evaluateInterviewAnswerRubric(params: {
  question: string;
  answerGuidance: string;
  keyPoints: string[];
  answerText: string;
  interviewType?: 'TECHNICAL' | 'HR' | 'PROJECT' | 'COMPANY';
}): RubricEvaluationResult {
  const cleanAnswer = (params.answerText || '').trim().slice(0, 3000);
  const lower = cleanAnswer.toLowerCase();
  const words = cleanAnswer.split(/\s+/).filter(Boolean);
  const sentences = cleanAnswer
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (words.length < 5) {
    return {
      source: 'RUBRIC',
      relevance: 1,
      structure: 1,
      completeness: 0,
      clarity: 1,
      overallScore100: 15,
      summary: 'Response is too brief for a substantive technical or behavioral evaluation.',
      strengths: ['Submitted an initial response attempt'],
      improvements: [
        'Expand your explanation to at least 4–6 structured sentences.',
        ...(params.keyPoints.slice(0, 2).map((kp) => `Cover key point: ${kp}`)),
      ],
      refinedSampleAnswer: params.answerGuidance,
    };
  }

  // 1. KeyPoints coverage -> Relevance & Completeness
  const keyPoints = params.keyPoints.length > 0 ? params.keyPoints : [params.answerGuidance];
  const matchedPoints: string[] = [];
  const missedPoints: string[] = [];

  for (const kp of keyPoints) {
    const tokens = kp
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length >= 4);
    const hits = tokens.filter((t) => lower.includes(t)).length;
    if (tokens.length > 0 && hits >= Math.max(1, Math.ceil(tokens.length * 0.35))) {
      matchedPoints.push(kp);
    } else {
      missedPoints.push(kp);
    }
  }

  const coverageRatio = keyPoints.length > 0 ? matchedPoints.length / keyPoints.length : 0.6;
  const relevance = Math.min(5, Math.max(1, Math.round(1.5 + coverageRatio * 3.5)));
  const completeness = Math.min(
    5,
    Math.max(1, Math.round(coverageRatio * 4 + (words.length >= 45 ? 1 : 0)))
  );

  // 2. Structure (STAR markers for HR/Project; complexity/trade-offs/steps for Technical)
  const hasStarMarkers =
    /\b(situation|task|action|result|impact|challenge|outcome|learned)\b/i.test(cleanAnswer);
  const hasTechStructure =
    /\b(o\(|complexity|time|space|edge case|trade-?off|first|second|finally|because|therefore)\b/i.test(
      cleanAnswer
    );
  const structure = Math.min(
    5,
    Math.max(
      1,
      (sentences.length >= 3 ? 2 : 1) +
        (hasStarMarkers || hasTechStructure ? 2 : 0) +
        (words.length >= 60 ? 1 : 0)
    )
  );

  // 3. Clarity (avg sentence length reasonable, clear connectives)
  const avgWordsPerSentence = words.length / Math.max(1, sentences.length);
  const goodCadence = avgWordsPerSentence >= 8 && avgWordsPerSentence <= 32;
  const clarity = Math.min(
    5,
    Math.max(2, (goodCadence ? 4 : 3) + (words.length >= 35 ? 1 : 0))
  );

  const overallScore100 = Math.round(((relevance + structure + completeness + clarity) / 20) * 100);

  const strengths: string[] = [];
  if (matchedPoints.length > 0) {
    strengths.push(`Addressed core concepts: ${matchedPoints.slice(0, 2).join('; ')}`);
  }
  if (hasTechStructure) {
    strengths.push('Included algorithmic complexity, trade-offs, or logical step transitions');
  }
  if (hasStarMarkers) {
    strengths.push('Demonstrated structured context, action, and outcome framing');
  }
  if (strengths.length === 0) {
    strengths.push('Clear written articulation on the topic');
  }

  const improvements: string[] = [];
  for (const mp of missedPoints.slice(0, 2)) {
    improvements.push(`Explicitly discuss: ${mp}`);
  }
  if (!hasTechStructure && params.interviewType !== 'HR') {
    improvements.push('State time/space complexity and boundary edge cases explicitly.');
  }
  if (!hasStarMarkers && params.interviewType === 'HR') {
    improvements.push('Frame behavioral examples using Situation, Task, Action, and quantified Result.');
  }
  if (improvements.length === 0) {
    improvements.push('Add one concrete production or project metric to make the answer memorable.');
  }

  return {
    source: 'RUBRIC',
    relevance,
    structure,
    completeness,
    clarity,
    overallScore100,
    summary: `Deterministic text rubric evaluation: ${overallScore100}/100 (Relevance ${relevance}/5, Structure ${structure}/5, Completeness ${completeness}/5, Clarity ${clarity}/5).`,
    strengths,
    improvements,
    refinedSampleAnswer: params.answerGuidance,
  };
}
