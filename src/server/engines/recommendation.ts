import {
  doesBranchMatchAllowed,
  evaluateEligibility,
  type EligibilityOutcome,
  type RoleRequirementInput,
  type StudentAcademicInput,
} from './eligibility.ts';

export interface SkillDescriptor {
  id: string;
  name: string;
  category: string;
  aliases?: string[];
}

export interface RequiredSkillDescriptor extends SkillDescriptor {
  importance: 'MUST' | 'GOOD';
}

export interface StudentRecommendationInput {
  academics: StudentAcademicInput;
  skills: SkillDescriptor[];
  projects: { title: string; description?: string | null; technologies: string[] }[];
  certifications: { name: string; issuer: string }[];
}

export interface CandidateRoleInput {
  jobRoleId: string;
  roleTitle: string;
  companyId: string;
  companyName: string;
  dataStatus: 'SAMPLE' | 'VERIFIED';
  requirement?: RoleRequirementInput | null;
  requiredSkills: RequiredSkillDescriptor[];
}

export interface RankedRoleRecommendation {
  jobRoleId: string;
  roleTitle: string;
  companyId: string;
  companyName: string;
  dataStatus: 'SAMPLE' | 'VERIFIED';
  matchScore: number;
  academicScore: number | null;
  skillScore: number | null;
  branchScore: number | null;
  projectScore: number | null;
  certScore: number | null;
  matchingSkills: string[];
  missingSkills: string[];
  eligibility: EligibilityOutcome;
  coveragePct: number;
  partial: boolean;
  coverageNotes: string[];
  explanation: string;
  rank: number;
}

const normalizeToken = (s: string) => s.trim().toLowerCase();

export function getSkillTokens(skill: Pick<SkillDescriptor, 'name' | 'aliases'>): Set<string> {
  const tokens = new Set<string>();
  tokens.add(normalizeToken(skill.name));
  for (const a of skill.aliases || []) {
    if (a && a.trim()) tokens.add(normalizeToken(a));
  }
  return tokens;
}

export function matchStudentSkillAgainstRequired(
  required: SkillDescriptor,
  studentSkills: SkillDescriptor[]
): 'EXACT' | 'PARTIAL' | 'NONE' {
  const reqTokens = getSkillTokens(required);

  for (const stu of studentSkills) {
    if (stu.id && required.id && stu.id === required.id) return 'EXACT';
    const stuTokens = getSkillTokens(stu);
    for (const t of reqTokens) {
      if (stuTokens.has(t)) return 'EXACT';
    }
  }

  // Same-category related skill counts as partial (0.5) per Part H3/H4
  for (const stu of studentSkills) {
    if (stu.category && required.category && stu.category === required.category) {
      return 'PARTIAL';
    }
  }

  return 'NONE';
}

function textContainsSkill(haystackLower: string, skill: SkillDescriptor): boolean {
  for (const token of getSkillTokens(skill)) {
    if (!token) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, 'i');
    if (regex.test(haystackLower)) return true;
  }
  return false;
}

/**
 * Part H3 — Rule-Based Recommendation Engine (0..100)
 * Weights: 0.30*Academic + 0.40*Skill + 0.10*Branch + 0.10*Projects + 0.10*Certs
 * Null components are excluded and remaining weights renormalized.
 * Never described as machine learning.
 */
export function computeRecommendations(
  student: StudentRecommendationInput,
  roles: CandidateRoleInput[]
): { items: RankedRoleRecommendation[]; coverageNote: string | null } {
  const globalNotes = new Set<string>();

  const unranked = roles.map((role) => {
    const coverageNotes: string[] = [];
    const eligibilityEval = evaluateEligibility(student.academics, role.requirement);

    // 1. Academic Score (weight 0.30)
    let academicScore: number | null = null;
    const ratios: number[] = [];
    const req = role.requirement;
    if (req) {
      if (req.minCgpa !== null && req.minCgpa !== undefined && Number(req.minCgpa) > 0) {
        if (student.academics.cgpa !== null && student.academics.cgpa !== undefined) {
          ratios.push(Math.min(1, Number(student.academics.cgpa) / Number(req.minCgpa)));
        } else {
          coverageNotes.push('CGPA missing');
          globalNotes.add('Academic score partial: CGPA missing');
        }
      }
      if (req.minTenthPct !== null && req.minTenthPct !== undefined && Number(req.minTenthPct) > 0) {
        if (student.academics.tenthPct !== null && student.academics.tenthPct !== undefined) {
          ratios.push(Math.min(1, Number(student.academics.tenthPct) / Number(req.minTenthPct)));
        } else {
          coverageNotes.push('10th % missing');
          globalNotes.add('Academic score partial: 10th % missing');
        }
      }
      if (
        req.minTwelfthPct !== null &&
        req.minTwelfthPct !== undefined &&
        Number(req.minTwelfthPct) > 0
      ) {
        const stuTwelfth =
          student.academics.twelfthPct ?? student.academics.diplomaPct ?? null;
        if (stuTwelfth !== null && stuTwelfth !== undefined) {
          ratios.push(Math.min(1, Number(stuTwelfth) / Number(req.minTwelfthPct)));
        } else {
          coverageNotes.push('12th % missing');
          globalNotes.add('Academic score partial: 12th % missing');
        }
      }
    }
    if (ratios.length > 0) {
      academicScore = Number(((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100).toFixed(2));
    }

    // 2. Skill Score (weight 0.40; MUST=2, GOOD=1)
    let skillScore: number | null = null;
    const matchingSkills: string[] = [];
    const missingSkills: string[] = [];
    if (role.requiredSkills.length > 0) {
      let weightedHit = 0;
      let totalWeight = 0;
      for (const reqSkill of role.requiredSkills) {
        const w = reqSkill.importance === 'MUST' ? 2 : 1;
        totalWeight += w;
        const matchKind = matchStudentSkillAgainstRequired(reqSkill, student.skills);
        if (matchKind === 'EXACT') {
          weightedHit += w * 1;
          matchingSkills.push(reqSkill.name);
        } else if (matchKind === 'PARTIAL') {
          weightedHit += w * 0.5;
          missingSkills.push(reqSkill.name);
        } else {
          missingSkills.push(reqSkill.name);
        }
      }
      skillScore =
        totalWeight > 0 ? Number(((weightedHit / totalWeight) * 100).toFixed(2)) : null;
    }

    // 3. Branch Score (weight 0.10)
    let branchScore: number | null = null;
    const allowedBranches = role.requirement?.allowedBranches || [];
    if (allowedBranches.length === 0) {
      branchScore = 100;
    } else {
      const bm = doesBranchMatchAllowed(student.academics.department, allowedBranches);
      if (bm.matched === null) {
        branchScore = null;
        coverageNotes.push('Department missing');
        globalNotes.add('Branch score excluded: department missing');
      } else {
        branchScore = bm.matched ? 100 : 0;
      }
    }

    // 4. Projects Score (weight 0.10)
    let projectScore: number | null = null;
    if (role.requiredSkills.length > 0) {
      if (student.projects.length === 0) {
        projectScore = 0;
      } else {
        const combinedProjectsText = student.projects
          .map((p) => `${p.title} ${p.description || ''} ${(p.technologies || []).join(' ')}`)
          .join(' \n ')
          .toLowerCase();
        let hits = 0;
        for (const reqSkill of role.requiredSkills) {
          if (textContainsSkill(combinedProjectsText, reqSkill)) {
            hits++;
          }
        }
        projectScore = Number(((hits / role.requiredSkills.length) * 100).toFixed(2));
      }
    }

    // 5. Certifications Score (weight 0.10)
    let certScore: number | null = 0;
    if (role.requiredSkills.length === 0) {
      certScore = null;
    } else if (student.certifications.length === 0) {
      certScore = 0;
    } else {
      const combinedCertsText = student.certifications
        .map((c) => `${c.name} ${c.issuer}`)
        .join(' \n ')
        .toLowerCase();
      let hits = 0;
      for (const reqSkill of role.requiredSkills) {
        if (textContainsSkill(combinedCertsText, reqSkill)) {
          hits++;
        }
      }
      certScore = Number(((hits / role.requiredSkills.length) * 100).toFixed(2));
    }

    const components: { key: string; weight: number; value: number | null }[] = [
      { key: 'academic', weight: 0.3, value: academicScore },
      { key: 'skill', weight: 0.4, value: skillScore },
      { key: 'branch', weight: 0.1, value: branchScore },
      { key: 'project', weight: 0.1, value: projectScore },
      { key: 'cert', weight: 0.1, value: certScore },
    ];

    let activeWeightSum = 0;
    let weightedTotal = 0;
    for (const c of components) {
      if (c.value !== null) {
        activeWeightSum += c.weight;
        weightedTotal += c.weight * c.value;
      }
    }

    const matchScore =
      activeWeightSum > 0 ? Number((weightedTotal / activeWeightSum).toFixed(2)) : 0;
    const coveragePct = Math.round(activeWeightSum * 100);
    const partial = coveragePct < 100 || coverageNotes.length > 0;

    // Deterministic explanation string: strongest component + biggest gap + eligibility reason
    const nonNullSorted = components
      .filter((c): c is { key: string; weight: number; value: number } => c.value !== null)
      .sort((a, b) => b.value - a.value);
    const strongest = nonNullSorted[0];
    const strongText =
      strongest?.key === 'skill'
        ? `Strong skill alignment (${matchingSkills.length}/${role.requiredSkills.length} required skills)`
        : strongest?.key === 'academic'
        ? `Solid academic alignment (${academicScore?.toFixed(0)}%)`
        : `Matching ${strongest?.key || 'profile'} credentials`;

    const gapText =
      missingSkills.length > 0
        ? `focus on ${missingSkills.slice(0, 2).join(', ')} to raise fit`
        : 'all core role skills covered';

    const failedCrit = eligibilityEval.results.find((r) => r.status === 'FAIL');
    const unknownCrit = eligibilityEval.results.find((r) => r.status === 'UNKNOWN');
    const eligSuffix = failedCrit
      ? `Currently NOT_ELIGIBLE: ${failedCrit.explanation}`
      : unknownCrit
      ? `INSUFFICIENT_INFO: ${unknownCrit.explanation}`
      : 'Meets configured academic eligibility criteria.';

    const explanation = `${strongText}; ${gapText}. ${eligSuffix}`;

    return {
      jobRoleId: role.jobRoleId,
      roleTitle: role.roleTitle,
      companyId: role.companyId,
      companyName: role.companyName,
      dataStatus: role.dataStatus,
      matchScore,
      academicScore,
      skillScore,
      branchScore,
      projectScore,
      certScore,
      matchingSkills,
      missingSkills,
      eligibility: eligibilityEval.status,
      coveragePct,
      partial,
      coverageNotes,
      explanation,
      rank: 0,
    };
  });

  const eligOrder: Record<EligibilityOutcome, number> = {
    ELIGIBLE: 3,
    INSUFFICIENT_INFO: 2,
    NOT_ELIGIBLE: 1,
  };

  unranked.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (eligOrder[b.eligibility] !== eligOrder[a.eligibility]) {
      return eligOrder[b.eligibility] - eligOrder[a.eligibility];
    }
    return a.companyName.localeCompare(b.companyName);
  });

  const items = unranked.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  return {
    items,
    coverageNote: globalNotes.size > 0 ? Array.from(globalNotes).join('; ') : null,
  };
}
