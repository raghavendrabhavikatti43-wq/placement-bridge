import {
  matchStudentSkillAgainstRequired,
  type RequiredSkillDescriptor,
  type SkillDescriptor,
} from './recommendation.ts';

export type SkillGapStatus = 'HAVE' | 'PARTIAL' | 'MISSING';
export type GapPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ResourceSummary {
  id: string;
  title: string;
  url: string;
  type: string;
  skillId?: string | null;
  topicId?: string | null;
}

export interface TopicNode {
  id: string;
  category: string;
  title: string;
  sequenceOrder: number;
  prerequisiteId?: string | null;
}

export interface ComputedSkillGapItem {
  skillId: string;
  skillName: string;
  category: string;
  importance: 'MUST' | 'GOOD';
  status: SkillGapStatus;
  priority: GapPriority;
  resources: ResourceSummary[];
}

export interface ComputedSkillGapReport {
  coveragePct: number;
  items: ComputedSkillGapItem[];
  roadmapTopics: TopicNode[];
}

/**
 * Part H4 — Skill Gap Engine
 * - HAVE if exact/alias match; PARTIAL if student has related skill in same category; else MISSING
 * - Priority: MUST+MISSING = HIGH; GOOD+MISSING or MUST+PARTIAL = MEDIUM; else LOW
 * - Coverage % = (HAVE + 0.5*PARTIAL) / total * 100
 * - Roadmap = PreparationTopics mapped from missing/partial skill resources ordered by prerequisite chain
 */
export function computeSkillGap(
  studentSkills: SkillDescriptor[],
  requiredSkills: RequiredSkillDescriptor[],
  allResources: ResourceSummary[] = [],
  allTopics: TopicNode[] = []
): ComputedSkillGapReport {
  // Deduplicate required skills keeping highest importance (MUST > GOOD)
  const deduped = new Map<string, RequiredSkillDescriptor>();
  for (const req of requiredSkills) {
    const key = req.id || req.name.toLowerCase();
    const prev = deduped.get(key);
    if (!prev || (prev.importance === 'GOOD' && req.importance === 'MUST')) {
      deduped.set(key, req);
    }
  }

  const uniqueRequired = Array.from(deduped.values());
  if (uniqueRequired.length === 0) {
    return { coveragePct: 100, items: [], roadmapTopics: [] };
  }

  let haveCount = 0;
  let partialCount = 0;
  const neededTopicIds = new Set<string>();

  const items: ComputedSkillGapItem[] = uniqueRequired.map((req) => {
    const matchKind = matchStudentSkillAgainstRequired(req, studentSkills);
    const status: SkillGapStatus =
      matchKind === 'EXACT' ? 'HAVE' : matchKind === 'PARTIAL' ? 'PARTIAL' : 'MISSING';

    if (status === 'HAVE') haveCount++;
    else if (status === 'PARTIAL') partialCount++;

    let priority: GapPriority = 'LOW';
    if (req.importance === 'MUST' && status === 'MISSING') {
      priority = 'HIGH';
    } else if (
      (req.importance === 'GOOD' && status === 'MISSING') ||
      (req.importance === 'MUST' && status === 'PARTIAL')
    ) {
      priority = 'MEDIUM';
    }

    const resources = allResources.filter((r) => r.skillId && r.skillId === req.id);
    if (status !== 'HAVE') {
      for (const r of resources) {
        if (r.topicId) neededTopicIds.add(r.topicId);
      }
    }

    return {
      skillId: req.id,
      skillName: req.name,
      category: req.category,
      importance: req.importance,
      status,
      priority,
      resources,
    };
  });

  // Sort items: HIGH -> MEDIUM -> LOW, then MISSING -> PARTIAL -> HAVE
  const prioWeight: Record<GapPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const statusWeight: Record<SkillGapStatus, number> = { MISSING: 3, PARTIAL: 2, HAVE: 1 };
  items.sort((a, b) => {
    if (prioWeight[b.priority] !== prioWeight[a.priority]) {
      return prioWeight[b.priority] - prioWeight[a.priority];
    }
    return statusWeight[b.status] - statusWeight[a.status];
  });

  const coveragePct = Number(
    (((haveCount + 0.5 * partialCount) / uniqueRequired.length) * 100).toFixed(2)
  );

  // Build prerequisite-ordered topic chain
  const topicMap = new Map(allTopics.map((t) => [t.id, t]));
  const orderedRoadmap: TopicNode[] = [];
  const visited = new Set<string>();

  const visitWithPrereqs = (topicId: string, stack = new Set<string>()) => {
    if (visited.has(topicId) || stack.has(topicId)) return;
    const node = topicMap.get(topicId);
    if (!node) return;
    stack.add(topicId);
    if (node.prerequisiteId) {
      visitWithPrereqs(node.prerequisiteId, stack);
    }
    stack.delete(topicId);
    visited.add(topicId);
    orderedRoadmap.push(node);
  };

  for (const tid of neededTopicIds) {
    visitWithPrereqs(tid);
  }

  return {
    coveragePct,
    items,
    roadmapTopics: orderedRoadmap,
  };
}
