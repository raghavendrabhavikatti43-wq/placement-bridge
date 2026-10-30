export type EligibilityOutcome = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'INSUFFICIENT_INFO';
export type CriterionOutcome = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface StudentAcademicInput {
  cgpa?: number | null;
  tenthPct?: number | null;
  twelfthPct?: number | null;
  diplomaPct?: number | null;
  department?: string | null;
  activeBacklogs?: number | null;
  totalBacklogs?: number | null;
  graduationYear?: number | null;
}

export interface RoleRequirementInput {
  minCgpa?: number | null;
  minTenthPct?: number | null;
  minTwelfthPct?: number | null;
  allowedBranches?: string[] | null;
  maxActiveBacklogs?: number | null;
  maxTotalBacklogs?: number | null;
  graduationYear?: number | null;
}

export interface CriterionEvaluation {
  criterion: string;
  studentValue: string | number | null;
  requiredValue: string | number | null;
  status: CriterionOutcome;
  explanation: string;
}

export interface EligibilityEvaluation {
  status: EligibilityOutcome;
  results: CriterionEvaluation[];
  missingFields: string[];
}

const BRANCH_ALIAS_GROUPS: Record<string, string[]> = {
  CSE: [
    'cse',
    'cs',
    'computer science',
    'computer science and engineering',
    'computer science & engineering',
    'computer engg',
    'computer engg (cse)',
    'computer science (cse)',
    'b.tech cse',
    'ise',
    'ai&ml',
    'aiml',
  ],
  IT: [
    'it',
    'information technology',
    'information tech',
    'information tech (it)',
    'information technology (it)',
    'information science',
  ],
  ECE: [
    'ece',
    'electronics and communication',
    'electronics & communication',
    'electronics & comm',
    'electronics & comm (ece)',
    'electronics & comm. (ece)',
    'entc',
    'etc',
  ],
  EE: [
    'ee',
    'eee',
    'electrical',
    'electrical engineering',
    'electrical engg',
    'electrical engg (ee)',
    'electrical engineering (ee)',
    'electrical and electronics',
  ],
  ME: [
    'me',
    'mech',
    'mechanical',
    'mechanical engineering',
    'mechanical engg',
    'mechanical engg (me)',
    'mechanical engineering (me)',
  ],
  CE: ['ce', 'civil', 'civil engineering', 'civil engg'],
};

const WILDCARD_BRANCH_TOKENS = [
  'all',
  'all branches',
  'all b.tech branches',
  'all engineering branches',
  'any',
];

const CIRCUITAL_BRANCHES = new Set(['CSE', 'IT', 'ECE', 'EE']);

export function normalizeBranchCode(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().toLowerCase();
  if (WILDCARD_BRANCH_TOKENS.includes(cleaned)) return 'ALL';
  if (cleaned === 'circuital' || cleaned === 'circuital branches') return 'CIRCUITAL';

  for (const [canonical, aliases] of Object.entries(BRANCH_ALIAS_GROUPS)) {
    if (canonical.toLowerCase() === cleaned || aliases.includes(cleaned)) {
      return canonical;
    }
    if (cleaned.includes(`(${canonical.toLowerCase()})`)) {
      return canonical;
    }
  }
  return cleaned.toUpperCase();
}

export function doesBranchMatchAllowed(
  studentDepartment: string | null | undefined,
  allowedBranches: string[] | null | undefined
): { matched: boolean | null; normalizedStudent: string | null } {
  const allowed = (allowedBranches || []).filter((b) => b && b.trim().length > 0);
  if (allowed.length === 0) {
    return { matched: true, normalizedStudent: normalizeBranchCode(studentDepartment) };
  }

  const normalizedAllowed = allowed.map((b) => normalizeBranchCode(b)).filter(Boolean) as string[];
  if (normalizedAllowed.includes('ALL')) {
    return { matched: true, normalizedStudent: normalizeBranchCode(studentDepartment) };
  }

  const studentNorm = normalizeBranchCode(studentDepartment);
  if (!studentNorm) {
    return { matched: null, normalizedStudent: null };
  }

  if (normalizedAllowed.includes(studentNorm)) {
    return { matched: true, normalizedStudent: studentNorm };
  }

  if (normalizedAllowed.includes('CIRCUITAL') && CIRCUITAL_BRANCHES.has(studentNorm)) {
    return { matched: true, normalizedStudent: studentNorm };
  }

  return { matched: false, normalizedStudent: studentNorm };
}

/**
 * Part H2 — Deterministic Rule-Based Eligibility Engine
 * Note: FAIL strictly outranks UNKNOWN (if any criterion is FAIL -> NOT_ELIGIBLE).
 */
export function evaluateEligibility(
  student: StudentAcademicInput,
  requirement?: RoleRequirementInput | null
): EligibilityEvaluation {
  if (!requirement) {
    return {
      status: 'ELIGIBLE',
      results: [
        {
          criterion: 'General Criteria',
          studentValue: 'Open',
          requiredValue: 'No minimum restrictions configured',
          status: 'PASS',
          explanation: 'No restrictive academic cutoffs are configured for this role.',
        },
      ],
      missingFields: [],
    };
  }

  const results: CriterionEvaluation[] = [];
  const missingFields: string[] = [];

  // 1. Minimum CGPA
  if (requirement.minCgpa !== null && requirement.minCgpa !== undefined) {
    const reqCgpa = Number(requirement.minCgpa);
    if (student.cgpa === null || student.cgpa === undefined || Number.isNaN(Number(student.cgpa))) {
      missingFields.push('cgpa');
      results.push({
        criterion: 'CGPA',
        studentValue: null,
        requiredValue: reqCgpa,
        status: 'UNKNOWN',
        explanation: `Student CGPA is not filled in profile (minimum ${reqCgpa.toFixed(2)} required).`,
      });
    } else {
      const stuCgpa = Number(student.cgpa);
      const pass = stuCgpa >= reqCgpa;
      results.push({
        criterion: 'CGPA',
        studentValue: stuCgpa,
        requiredValue: reqCgpa,
        status: pass ? 'PASS' : 'FAIL',
        explanation: pass
          ? `CGPA ${stuCgpa.toFixed(2)} meets the minimum cutoff of ${reqCgpa.toFixed(2)}.`
          : `CGPA ${stuCgpa.toFixed(2)} is below the required minimum of ${reqCgpa.toFixed(2)}.`,
      });
    }
  }

  // 2. Minimum 10th %
  if (requirement.minTenthPct !== null && requirement.minTenthPct !== undefined) {
    const reqTenth = Number(requirement.minTenthPct);
    if (
      student.tenthPct === null ||
      student.tenthPct === undefined ||
      Number.isNaN(Number(student.tenthPct))
    ) {
      missingFields.push('tenthPct');
      results.push({
        criterion: '10th Percentage',
        studentValue: null,
        requiredValue: reqTenth,
        status: 'UNKNOWN',
        explanation: `10th standard percentage is missing (minimum ${reqTenth}% required).`,
      });
    } else {
      const stuTenth = Number(student.tenthPct);
      const pass = stuTenth >= reqTenth;
      results.push({
        criterion: '10th Percentage',
        studentValue: stuTenth,
        requiredValue: reqTenth,
        status: pass ? 'PASS' : 'FAIL',
        explanation: pass
          ? `10th percentage ${stuTenth}% meets the minimum ${reqTenth}%.`
          : `10th percentage ${stuTenth}% is below the minimum ${reqTenth}%.`,
      });
    }
  }

  // 3. Minimum 12th / Diploma %
  if (requirement.minTwelfthPct !== null && requirement.minTwelfthPct !== undefined) {
    const reqTwelfth = Number(requirement.minTwelfthPct);
    const effectiveTwelfth =
      student.twelfthPct !== null && student.twelfthPct !== undefined
        ? Number(student.twelfthPct)
        : student.diplomaPct !== null && student.diplomaPct !== undefined
        ? Number(student.diplomaPct)
        : null;

    if (effectiveTwelfth === null || Number.isNaN(effectiveTwelfth)) {
      missingFields.push('twelfthPct');
      results.push({
        criterion: '12th / Diploma Percentage',
        studentValue: null,
        requiredValue: reqTwelfth,
        status: 'UNKNOWN',
        explanation: `12th / Diploma percentage is missing (minimum ${reqTwelfth}% required).`,
      });
    } else {
      const pass = effectiveTwelfth >= reqTwelfth;
      results.push({
        criterion: '12th / Diploma Percentage',
        studentValue: effectiveTwelfth,
        requiredValue: reqTwelfth,
        status: pass ? 'PASS' : 'FAIL',
        explanation: pass
          ? `12th/Diploma score ${effectiveTwelfth}% meets the minimum ${reqTwelfth}%.`
          : `12th/Diploma score ${effectiveTwelfth}% is below the minimum ${reqTwelfth}%.`,
      });
    }
  }

  // 4. Allowed Branches
  const allowedBranches = (requirement.allowedBranches || []).filter((b) => b && b.trim());
  if (allowedBranches.length > 0) {
    const branchMatch = doesBranchMatchAllowed(student.department, allowedBranches);
    const reqDisplay = allowedBranches.join(', ');
    if (branchMatch.matched === null) {
      missingFields.push('department');
      results.push({
        criterion: 'Department / Branch',
        studentValue: null,
        requiredValue: reqDisplay,
        status: 'UNKNOWN',
        explanation: `Student department is missing (allowed: ${reqDisplay}).`,
      });
    } else {
      results.push({
        criterion: 'Department / Branch',
        studentValue: student.department || branchMatch.normalizedStudent,
        requiredValue: reqDisplay,
        status: branchMatch.matched ? 'PASS' : 'FAIL',
        explanation: branchMatch.matched
          ? `Branch "${student.department}" (${branchMatch.normalizedStudent}) is eligible (${reqDisplay}).`
          : `Branch "${student.department}" (${branchMatch.normalizedStudent}) is not in allowed branches (${reqDisplay}).`,
      });
    }
  }

  // 5. Max Active Backlogs
  if (requirement.maxActiveBacklogs !== null && requirement.maxActiveBacklogs !== undefined) {
    const maxAct = Number(requirement.maxActiveBacklogs);
    if (student.activeBacklogs === null || student.activeBacklogs === undefined) {
      missingFields.push('activeBacklogs');
      results.push({
        criterion: 'Active Backlogs',
        studentValue: null,
        requiredValue: maxAct,
        status: 'UNKNOWN',
        explanation: `Active backlog count is missing (maximum ${maxAct} allowed).`,
      });
    } else {
      const stuAct = Number(student.activeBacklogs);
      const pass = stuAct <= maxAct;
      results.push({
        criterion: 'Active Backlogs',
        studentValue: stuAct,
        requiredValue: maxAct,
        status: pass ? 'PASS' : 'FAIL',
        explanation: pass
          ? stuAct === 0 && maxAct === 0
            ? 'No active backlogs; none allowed.'
            : `${stuAct} active backlog(s) within the allowed limit of ${maxAct}.`
          : `${stuAct} active backlog(s) exceeds the maximum allowed (${maxAct}).`,
      });
    }
  }

  // 6. Max Total Backlogs
  if (requirement.maxTotalBacklogs !== null && requirement.maxTotalBacklogs !== undefined) {
    const maxTot = Number(requirement.maxTotalBacklogs);
    if (student.totalBacklogs === null || student.totalBacklogs === undefined) {
      missingFields.push('totalBacklogs');
      results.push({
        criterion: 'Total Historical Backlogs',
        studentValue: null,
        requiredValue: maxTot,
        status: 'UNKNOWN',
        explanation: `Total backlog history is missing (maximum ${maxTot} allowed).`,
      });
    } else {
      const stuTot = Number(student.totalBacklogs);
      const pass = stuTot <= maxTot;
      results.push({
        criterion: 'Total Historical Backlogs',
        studentValue: stuTot,
        requiredValue: maxTot,
        status: pass ? 'PASS' : 'FAIL',
        explanation: pass
          ? `${stuTot} historical backlog(s) within maximum limit of ${maxTot}.`
          : `${stuTot} historical backlog(s) exceeds maximum limit of ${maxTot}.`,
      });
    }
  }

  // 7. Graduation Year
  if (requirement.graduationYear !== null && requirement.graduationYear !== undefined) {
    const reqYear = Number(requirement.graduationYear);
    if (student.graduationYear === null || student.graduationYear === undefined) {
      missingFields.push('graduationYear');
      results.push({
        criterion: 'Graduation Batch',
        studentValue: null,
        requiredValue: reqYear,
        status: 'UNKNOWN',
        explanation: `Graduation year is missing (target batch: ${reqYear}).`,
      });
    } else {
      const stuYear = Number(student.graduationYear);
      const pass = stuYear === reqYear;
      results.push({
        criterion: 'Graduation Batch',
        studentValue: stuYear,
        requiredValue: reqYear,
        status: pass ? 'PASS' : 'FAIL',
        explanation: pass
          ? `Graduation batch ${stuYear} matches required ${reqYear} cohort.`
          : `Graduation batch ${stuYear} does not match required ${reqYear} cohort.`,
      });
    }
  }

  const hasFail = results.some((r) => r.status === 'FAIL');
  const hasUnknown = results.some((r) => r.status === 'UNKNOWN');

  const status: EligibilityOutcome = hasFail
    ? 'NOT_ELIGIBLE'
    : hasUnknown
    ? 'INSUFFICIENT_INFO'
    : 'ELIGIBLE';

  return {
    status,
    results,
    missingFields,
  };
}
