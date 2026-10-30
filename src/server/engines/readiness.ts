export const READINESS_DISCLAIMER =
  'Educational preparation indicator, not a prediction or guarantee of placement.';

export interface ReadinessInput {
  academics: {
    cgpa?: number | null;
    tenthPct?: number | null;
    twelfthPct?: number | null;
    diplomaPct?: number | null;
    activeBacklogs?: number | null;
    totalBacklogs?: number | null;
  };
  technical: {
    skillsProficiencies: number[]; // each 1..5
    completedTechnicalTopics: number;
    totalTechnicalTopics: number;
    hasAnyTopicActivity: boolean;
  };
  aptitude: {
    // category -> recent attempt percentages (most recent first or last 3)
    attemptsByCategory: Record<string, number[]>;
  };
  coding: {
    totalSubmissions: number;
    problems: { id: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; isSolved: boolean }[];
  };
  interview: {
    reviewedQuestions: number;
    completedSessions: number;
    hasActivity: boolean;
  };
  projects: {
    items: {
      description?: string | null;
      technologies?: string[];
      githubUrl?: string | null;
    }[];
  };
}

export interface ReadinessNextAction {
  label: string;
  link: string;
  category: string;
}

export interface ReadinessEvaluation {
  overall: number;
  isProvisional: boolean;
  coveragePct: number;
  missing: string[];
  categories: {
    academics: number | null;
    technical: number | null;
    aptitude: number | null;
    coding: number | null;
    interview: number | null;
    projects: number | null;
  };
  strengths: string[];
  weakAreas: string[];
  nextActions: ReadinessNextAction[];
  disclaimer: string;
}

const ACTION_MAP: Record<string, ReadinessNextAction> = {
  academics: {
    label: 'Complete your CGPA, 10th/12th scores, and backlog details in My Profile',
    link: 'my-profile',
    category: 'academics',
  },
  technical: {
    label: 'Add core technical skills and complete 2 technical roadmap modules',
    link: 'study-plan',
    category: 'technical',
  },
  aptitude: {
    label: 'Take a timed Quantitative & Logical Reasoning aptitude drill',
    link: 'aptitude-practice',
    category: 'aptitude',
  },
  coding: {
    label: 'Solve 3 DSA Array & Graph coding problems in the Coding Workspace',
    link: 'coding-practice',
    category: 'coding',
  },
  interview: {
    label: 'Complete a mock technical & STAR behavioral interview session',
    link: 'interview-prep',
    category: 'interview',
  },
  projects: {
    label: 'Document at least 2 engineering projects with tech stack and GitHub links',
    link: 'my-profile',
    category: 'projects',
  },
};

/**
 * Part H7 — Placement Readiness Engine (0..100)
 * Weights: academics 0.20, technical 0.25, aptitude 0.15, coding 0.15, interview 0.15, projects 0.10.
 * Null components are NEVER converted to 0 or 100 — they are excluded and remaining weights renormalized!
 */
export function computeReadiness(input: ReadinessInput): ReadinessEvaluation {
  // 1. Academics (0.20)
  let academics: number | null = null;
  const hasCgpa = input.academics.cgpa !== null && input.academics.cgpa !== undefined;
  const hasTenth = input.academics.tenthPct !== null && input.academics.tenthPct !== undefined;
  const effectiveTwelfth = input.academics.twelfthPct ?? input.academics.diplomaPct ?? null;
  const hasTwelfth = effectiveTwelfth !== null && effectiveTwelfth !== undefined;

  if (hasCgpa || hasTenth || hasTwelfth) {
    const parts: { w: number; v: number }[] = [];
    if (hasCgpa) parts.push({ w: 0.6, v: (Number(input.academics.cgpa) / 10) * 100 });
    if (hasTenth) parts.push({ w: 0.2, v: Number(input.academics.tenthPct) });
    if (hasTwelfth) parts.push({ w: 0.2, v: Number(effectiveTwelfth) });

    const wSum = parts.reduce((acc, p) => acc + p.w, 0);
    const blended = parts.reduce((acc, p) => acc + p.w * p.v, 0) / wSum;

    const actBacklogs = Math.max(0, Number(input.academics.activeBacklogs ?? 0));
    const totBacklogs = Math.max(actBacklogs, Number(input.academics.totalBacklogs ?? actBacklogs));
    const historicalBacklogs = Math.max(0, totBacklogs - actBacklogs);
    const penalty = Math.min(15, 5 * actBacklogs + 2 * historicalBacklogs);

    academics = Number(Math.max(0, Math.min(100, blended - penalty)).toFixed(2));
  }

  // 2. Technical (0.25)
  let technical: number | null = null;
  const skillsCount = input.technical.skillsProficiencies.length;
  if (skillsCount > 0 || input.technical.hasAnyTopicActivity) {
    const breadth = Math.min(1, skillsCount / 12);
    const avgProf =
      skillsCount > 0
        ? input.technical.skillsProficiencies.reduce((a, b) => a + b, 0) / skillsCount
        : 0;
    const depth = Math.min(1, avgProf / 5);
    const topicCompletion =
      input.technical.totalTechnicalTopics > 0
        ? Math.min(
            1,
            input.technical.completedTechnicalTopics / input.technical.totalTechnicalTopics
          )
        : 0;
    technical = Number(((0.5 * breadth + 0.3 * depth + 0.2 * topicCompletion) * 100).toFixed(2));
  }

  // 3. Aptitude (0.15)
  let aptitude: number | null = null;
  const catEntries = Object.values(input.aptitude.attemptsByCategory).filter(
    (arr) => Array.isArray(arr) && arr.length > 0
  );
  if (catEntries.length > 0) {
    const bests = catEntries.map((scores) => {
      const last3 = scores.slice(-3);
      return Math.max(...last3);
    });
    aptitude = Number((bests.reduce((a, b) => a + b, 0) / bests.length).toFixed(2));
  }

  // 4. Coding (0.15)
  let coding: number | null = null;
  if (input.coding.totalSubmissions > 0 && input.coding.problems.length > 0) {
    const diffWeight = { EASY: 1, MEDIUM: 2, HARD: 3 } as const;
    let solvedWeight = 0;
    let scopeWeight = 0;
    for (const p of input.coding.problems) {
      const w = diffWeight[p.difficulty] ?? 1;
      scopeWeight += w;
      if (p.isSolved) solvedWeight += w;
    }
    coding = scopeWeight > 0 ? Number(((solvedWeight / scopeWeight) * 100).toFixed(2)) : 0;
  }

  // 5. Interview (0.15)
  let interview: number | null = null;
  if (
    input.interview.hasActivity ||
    input.interview.reviewedQuestions > 0 ||
    input.interview.completedSessions > 0
  ) {
    const qRatio = Math.min(1, input.interview.reviewedQuestions / 30);
    const sRatio = Math.min(1, input.interview.completedSessions / 3);
    interview = Number(((0.6 * qRatio + 0.4 * sRatio) * 100).toFixed(2));
  }

  // 6. Projects (0.10)
  let projects: number | null = null;
  if (input.projects.items.length > 0) {
    const completeProjects = input.projects.items.filter(
      (p) => Boolean(p.description && p.description.trim()) && (p.technologies?.length ?? 0) > 0
    ).length;
    const hasAnyLink = input.projects.items.some((p) => Boolean(p.githubUrl && p.githubUrl.trim()));
    const rawScore = 25 * Math.min(3, completeProjects) + (hasAnyLink ? 25 : 0);
    projects = Math.min(100, rawScore);
  }

  const weightedSpec: { key: keyof ReadinessEvaluation['categories']; weight: number; val: number | null }[] = [
    { key: 'academics', weight: 0.2, val: academics },
    { key: 'technical', weight: 0.25, val: technical },
    { key: 'aptitude', weight: 0.15, val: aptitude },
    { key: 'coding', weight: 0.15, val: coding },
    { key: 'interview', weight: 0.15, val: interview },
    { key: 'projects', weight: 0.1, val: projects },
  ];

  const missing: string[] = [];
  let sumWeights = 0;
  let weightedTotal = 0;

  for (const item of weightedSpec) {
    if (item.val === null) {
      missing.push(item.key);
    } else {
      sumWeights += item.weight;
      weightedTotal += item.weight * item.val;
    }
  }

  const overall = sumWeights > 0 ? Number((weightedTotal / sumWeights).toFixed(2)) : 0;
  const coveragePct = Math.round(sumWeights * 100);
  const isProvisional = coveragePct < 100;

  const nonNullSorted = weightedSpec
    .filter((i): i is { key: keyof ReadinessEvaluation['categories']; weight: number; val: number } => i.val !== null)
    .sort((a, b) => b.val - a.val);

  const strengths = nonNullSorted.slice(0, 2).map((i) => i.key);
  const weakAreas = [...nonNullSorted]
    .reverse()
    .filter((i) => i.val < 60)
    .slice(0, 2)
    .map((i) => i.key);

  const nextActions: ReadinessNextAction[] = [];
  const seenCats = new Set<string>();
  for (const w of [...weakAreas, ...missing]) {
    if (!seenCats.has(w) && ACTION_MAP[w]) {
      seenCats.add(w);
      nextActions.push(ACTION_MAP[w]);
    }
    if (nextActions.length >= 4) break;
  }

  return {
    overall,
    isProvisional,
    coveragePct,
    missing,
    categories: {
      academics,
      technical,
      aptitude,
      coding,
      interview,
      projects,
    },
    strengths,
    weakAreas,
    nextActions,
    disclaimer: READINESS_DISCLAIMER,
  };
}
