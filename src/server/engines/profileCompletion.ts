export interface ProfileCompletionInput {
  fullName?: string | null;
  phone?: string | null;
  college?: string | null;
  department?: string | null;
  semester?: number | null;
  graduationYear?: number | null;
  tenthPct?: number | string | null;
  twelfthPct?: number | string | null;
  cgpa?: number | string | null;
  totalBacklogs?: number | null;
  activeBacklogs?: number | null;
  skillsCount: number;
  projectsCount: number;
  certificationsCount: number;
  internshipsCount: number;
  achievementsCount: number;
  hasResume: boolean;
  hasPreferences: boolean;
}

export interface ProfileCompletionResult {
  pct: number;
  missing: string[];
  breakdown: {
    personal: number;
    academics: number;
    skills: number;
    projects: number;
    certifications: number;
    internshipOrAchievement: number;
    resume: number;
    preferences: number;
  };
}

const isFilled = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
};

/**
 * Part H1 — Profile Completion %
 * Weights:
 * - Personal: 15 (fullName, phone, college, department, graduationYear)
 * - Academics: 25 (tenthPct, twelfthPct, cgpa, totalBacklogs, activeBacklogs — 5 pts each)
 * - Skills >= 3: 20 (scaled proportionally for 1..2 skills)
 * - Projects >= 1: 15
 * - Certifications >= 1: 5
 * - Internship or Achievement >= 1: 5
 * - Resume uploaded / created: 10
 * - Preferences configured: 5
 * Total = 100
 */
export function computeProfileCompletion(input: ProfileCompletionInput): ProfileCompletionResult {
  const missing: string[] = [];

  // 1. Personal (15 pts across 5 fields = 3 pts each)
  const personalChecks: [string, unknown][] = [
    ['fullName', input.fullName],
    ['phone', input.phone],
    ['college', input.college],
    ['department', input.department],
    ['graduationYear', input.graduationYear],
  ];
  let personalScore = 0;
  for (const [key, val] of personalChecks) {
    if (isFilled(val)) {
      personalScore += 3;
    } else {
      missing.push(key);
    }
  }

  // 2. Academics (25 pts across 5 fields = 5 pts each)
  const academicChecks: [string, unknown][] = [
    ['tenthPct', input.tenthPct],
    ['twelfthPct', input.twelfthPct],
    ['cgpa', input.cgpa],
    ['totalBacklogs', input.totalBacklogs],
    ['activeBacklogs', input.activeBacklogs],
  ];
  let academicsScore = 0;
  for (const [key, val] of academicChecks) {
    if (isFilled(val)) {
      academicsScore += 5;
    } else {
      missing.push(key);
    }
  }

  // 3. Skills >= 3 (20 pts)
  let skillsScore = 0;
  if (input.skillsCount >= 3) {
    skillsScore = 20;
  } else {
    skillsScore = Math.round((Math.max(0, input.skillsCount) / 3) * 20);
    missing.push('skills (at least 3)');
  }

  // 4. Projects >= 1 (15 pts)
  const projectsScore = input.projectsCount >= 1 ? 15 : 0;
  if (!projectsScore) missing.push('projects (at least 1)');

  // 5. Certifications >= 1 (5 pts)
  const certificationsScore = input.certificationsCount >= 1 ? 5 : 0;
  if (!certificationsScore) missing.push('certifications (at least 1)');

  // 6. Internship or Achievement >= 1 (5 pts)
  const internshipOrAchievementScore =
    input.internshipsCount >= 1 || input.achievementsCount >= 1 ? 5 : 0;
  if (!internshipOrAchievementScore) missing.push('internship or achievement');

  // 7. Resume uploaded (10 pts)
  const resumeScore = input.hasResume ? 10 : 0;
  if (!resumeScore) missing.push('resume');

  // 8. Preferences (5 pts)
  const preferencesScore = input.hasPreferences ? 5 : 0;
  if (!preferencesScore) missing.push('preferences');

  const pct = Math.min(
    100,
    Math.max(
      0,
      personalScore +
        academicsScore +
        skillsScore +
        projectsScore +
        certificationsScore +
        internshipOrAchievementScore +
        resumeScore +
        preferencesScore
    )
  );

  return {
    pct,
    missing,
    breakdown: {
      personal: personalScore,
      academics: academicsScore,
      skills: skillsScore,
      projects: projectsScore,
      certifications: certificationsScore,
      internshipOrAchievement: internshipOrAchievementScore,
      resume: resumeScore,
      preferences: preferencesScore,
    },
  };
}
