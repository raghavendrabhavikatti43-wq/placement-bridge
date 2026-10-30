export type TopicProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface PrepTopicInput {
  id: string;
  category: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  sequenceOrder: number;
  prerequisiteId?: string | null;
  isActive?: boolean;
}

export interface EnrichedPrepTopic extends PrepTopicInput {
  status: TopicProgressState;
  locked: boolean;
}

/**
 * Part H5 — Preparation Roadmap & Next Recommended Topic Engine
 * A topic is unlocked only when its prerequisiteId is null or COMPLETED.
 * Next recommended topic = first non-completed & unlocked topic ordered by
 * category priority (derived from skill gaps + weak readiness areas), then sequenceOrder.
 */
export function evaluatePreparationRoadmap(
  topics: PrepTopicInput[],
  progressByTopicId: Record<string, TopicProgressState>,
  priorityCategories: string[] = []
): {
  roadmap: EnrichedPrepTopic[];
  nextRecommended: EnrichedPrepTopic | null;
  completedCount: number;
  totalCount: number;
} {
  const activeTopics = topics.filter((t) => t.isActive !== false);
  const completedIds = new Set(
    Object.entries(progressByTopicId)
      .filter(([, st]) => st === 'COMPLETED')
      .map(([id]) => id)
  );

  const enriched: EnrichedPrepTopic[] = activeTopics
    .map((t) => {
      const status = progressByTopicId[t.id] || 'NOT_STARTED';
      const locked = Boolean(t.prerequisiteId && !completedIds.has(t.prerequisiteId));
      return {
        ...t,
        status,
        locked,
      };
    })
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.sequenceOrder - b.sequenceOrder;
    });

  const normalizedPrio = priorityCategories.map((c) => c.trim().toLowerCase());
  const getCatRank = (cat: string): number => {
    const idx = normalizedPrio.findIndex(
      (p) => cat.toLowerCase() === p || cat.toLowerCase().includes(p)
    );
    return idx === -1 ? 999 : idx;
  };

  const candidates = enriched
    .filter((t) => t.status !== 'COMPLETED' && !t.locked)
    .sort((a, b) => {
      // Prefer IN_PROGRESS topics first within top priority, or sort strictly by priority + sequence
      const rankA = getCatRank(a.category);
      const rankB = getCatRank(b.category);
      if (rankA !== rankB) return rankA - rankB;
      if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
      if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;
      return a.sequenceOrder - b.sequenceOrder;
    });

  return {
    roadmap: enriched,
    nextRecommended: candidates[0] || null,
    completedCount: enriched.filter((t) => t.status === 'COMPLETED').length,
    totalCount: enriched.length,
  };
}
