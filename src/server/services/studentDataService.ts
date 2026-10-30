import { prisma, toNumber } from '../../db/prisma.ts';
import { computeProfileCompletion } from '../engines/profileCompletion.ts';
import { evaluateEligibility } from '../engines/eligibility.ts';
import {
  computeRecommendations,
  type CandidateRoleInput,
  type RequiredSkillDescriptor,
  type SkillDescriptor,
} from '../engines/recommendation.ts';
import { computeReadiness, type ReadinessEvaluation } from '../engines/readiness.ts';
import { getCgpaBand } from '../engines/redaction.ts';
import { computeSkillGap } from '../engines/skillGap.ts';
import { sanitizeDbError } from '../utils/errors.ts';
import type {
  ApplicationRecord,
  ApplicationStatus,
  CompanyDrive,
  PortalSettings,
  SkillGapItem,
  StudentProfile as FrontendStudentProfile,
  StudyPlanModule,
} from '../../types.ts';

const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  minTargetCtc: 8.5,
  dailyGoalHours: 3.5,
  driveAlerts: true,
  mockReminders: true,
  tpoProfileVisible: true,
};

export async function loadAllSkillsCatalogue(): Promise<SkillDescriptor[]> {
  try {
    const rows = await prisma.skill.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      aliases: r.aliases || [],
    }));
  } catch (err) {
    sanitizeDbError('loadAllSkillsCatalogue', err);
  }
}

export async function loadCandidateRolesFromDb(includeInactive = false): Promise<{
  roles: (CandidateRoleInput & {
    companySlug: string | null;
    logoIcon: string;
    category: string;
    location: string;
    packageInfo: string;
    driveDate: string;
    daysRemaining: number;
    institutionalNotes: string;
    website: string | null;
    industry: string | null;
    description: string | null;
    isActive: boolean;
    stages: { id: string; stageOrder: number; name: string; description: string | null }[];
  })[];
}> {
  try {
    const compRows = await prisma.company.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ daysRemaining: 'asc' }, { name: 'asc' }],
      include: {
        stages: {
          orderBy: { stageOrder: 'asc' },
        },
        jobRoles: {
          where: includeInactive ? undefined : { isActive: true },
          include: {
            requirement: true,
            requiredSkills: {
              include: {
                skill: true,
              },
            },
          },
        },
      },
    });

    if (compRows.length === 0) return { roles: [] };

    const resultRoles: (CandidateRoleInput & {
      companySlug: string | null;
      logoIcon: string;
      category: string;
      location: string;
      packageInfo: string;
      driveDate: string;
      daysRemaining: number;
      institutionalNotes: string;
      website: string | null;
      industry: string | null;
      description: string | null;
      isActive: boolean;
      stages: { id: string; stageOrder: number; name: string; description: string | null }[];
    })[] = [];

    for (const comp of compRows) {
      const stages = comp.stages.map((st) => ({
        id: st.id,
        stageOrder: st.stageOrder,
        name: st.name,
        description: st.description,
      }));

      for (const role of comp.jobRoles) {
        const req = role.requirement;
        const requiredSkills: RequiredSkillDescriptor[] = role.requiredSkills.map((rs) => ({
          id: rs.skill.id,
          name: rs.skill.name,
          category: rs.skill.category,
          aliases: rs.skill.aliases || [],
          importance: rs.importance,
        }));

        resultRoles.push({
          jobRoleId: role.id,
          roleTitle: role.title,
          companyId: comp.id,
          companyName: comp.name,
          companySlug: comp.slug,
          dataStatus: comp.dataStatus,
          logoIcon: comp.logoIcon || 'apartment',
          category: comp.category || comp.industry || 'Campus Recruiter',
          location: comp.location || 'Bengaluru / Hybrid',
          packageInfo: role.packageInfo || comp.packageInfo || 'TBD',
          driveDate: comp.driveDate || 'Upcoming',
          daysRemaining: comp.daysRemaining ?? 14,
          institutionalNotes: comp.institutionalNotes || '',
          website: comp.website,
          industry: comp.industry,
          description: role.description || comp.description,
          isActive: comp.isActive && role.isActive,
          stages,
          requirement: req
            ? {
                minCgpa: toNumber(req.minCgpa),
                minTenthPct: toNumber(req.minTenthPct),
                minTwelfthPct: toNumber(req.minTwelfthPct),
                allowedBranches: req.allowedBranches || [],
                maxActiveBacklogs: req.maxActiveBacklogs,
                maxTotalBacklogs: req.maxTotalBacklogs,
                graduationYear: req.graduationYear,
              }
            : null,
          requiredSkills,
        });
      }
    }

    return { roles: resultRoles };
  } catch (err) {
    sanitizeDbError('loadCandidateRolesFromDb', err);
  }
}

export interface StudentRecommendationContext {
  profile: {
    id: string;
    userId: string;
    fullName: string;
    department: string | null;
    graduationYear: number | null;
    cgpa: number | null;
    tenthPct: number | null;
    twelfthPct: number | null;
    diplomaPct: number | null;
    activeBacklogs: number;
    totalBacklogs: number;
  };
  skills: {
    skillId: string;
    proficiency: number;
    addedAt: Date;
    name: string;
    category: string;
    aliases: string[];
  }[];
  projects: {
    id: string;
    title: string;
    description: string | null;
    technologies: string[];
  }[];
  certifications: {
    id: string;
    name: string;
    issuer: string | null;
  }[];
}

export async function loadStudentRecommendationContext(
  studentId: string
): Promise<StudentRecommendationContext | null> {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        skills: { include: { skill: true } },
        projects: { orderBy: { createdAt: 'desc' } },
        certifications: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!profile) return null;

    return {
      profile: {
        id: profile.id,
        userId: profile.userId,
        fullName: profile.fullName,
        department: profile.department,
        graduationYear: profile.graduationYear,
        cgpa: toNumber(profile.cgpa),
        tenthPct: toNumber(profile.tenthPct),
        twelfthPct: toNumber(profile.twelfthPct),
        diplomaPct: toNumber(profile.diplomaPct),
        activeBacklogs: profile.activeBacklogs,
        totalBacklogs: profile.totalBacklogs,
      },
      skills: profile.skills.map((s) => ({
        skillId: s.skillId,
        proficiency: s.proficiency,
        addedAt: s.addedAt,
        name: s.skill.name,
        category: s.skill.category,
        aliases: s.skill.aliases,
      })),
      projects: profile.projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        technologies: p.technologies,
      })),
      certifications: profile.certifications.map((c) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuer,
      })),
    };
  } catch (err) {
    sanitizeDbError('loadStudentRecommendationContext', err);
  }
}

export async function loadStudentFullContext(studentId: string) {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        skills: {
          include: { skill: true },
          orderBy: { proficiency: 'desc' },
        },
        projects: { orderBy: { createdAt: 'desc' } },
        certifications: { orderBy: { createdAt: 'desc' } },
        internships: { orderBy: { createdAt: 'desc' } },
        achievements: { orderBy: { createdAt: 'desc' } },
        preferences: true,
        academicRecords: { orderBy: { semester: 'asc' } },
        resumes: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
      },
    });

    if (!profile) return null;

    const userRow = profile.user;
    const stuSkillsRows = [...profile.skills]
      .sort((a, b) => {
        if (b.proficiency !== a.proficiency) return b.proficiency - a.proficiency;
        return a.skill.name.localeCompare(b.skill.name);
      })
      .map((s) => ({
        skillId: s.skillId,
        proficiency: s.proficiency,
        addedAt: s.addedAt,
        name: s.skill.name,
        category: s.skill.category,
        aliases: s.skill.aliases,
      }));

    const cgpaNum = toNumber(profile.cgpa);
    const tenthNum = toNumber(profile.tenthPct);
    const twelfthNum = toNumber(profile.twelfthPct);
    const diplomaNum = toNumber(profile.diplomaPct);

    const [resumeFilesCount, readiness] = await Promise.all([
      prisma.fileAsset.count({ where: { ownerId: profile.userId } }),
      evaluateAndPersistStudentReadiness(studentId, false, {
        profile,
        stuSkillProficiencies: profile.skills.map((s) => s.proficiency),
        projectRows: profile.projects,
      }),
    ]);

    const pref = profile.preferences;
    const hasPreferences = Boolean(
      pref &&
        ((pref.preferredRoles?.length ?? 0) > 0 ||
          (pref.preferredIndustries?.length ?? 0) > 0 ||
          (pref.preferredLocations?.length ?? 0) > 0)
    );
    const hasResume =
      profile.resumes.length > 0 ||
      Boolean(profile.resumeSummary && profile.resumeSummary.trim().length > 20) ||
      resumeFilesCount > 0;

    const completion = computeProfileCompletion({
      fullName: profile.fullName,
      phone: profile.phone,
      college: profile.college,
      department: profile.department,
      semester: profile.semester,
      graduationYear: profile.graduationYear,
      tenthPct: tenthNum,
      twelfthPct: twelfthNum ?? diplomaNum,
      cgpa: cgpaNum,
      totalBacklogs: profile.totalBacklogs,
      activeBacklogs: profile.activeBacklogs,
      skillsCount: profile.skills.length,
      projectsCount: profile.projects.length,
      certificationsCount: profile.certifications.length,
      internshipsCount: profile.internships.length,
      achievementsCount: profile.achievements.length,
      hasResume,
      hasPreferences,
    });

    if (profile.completionPct !== completion.pct) {
      await prisma.studentProfile.update({
        where: { id: studentId },
        data: { completionPct: completion.pct },
      });
    }

    const frontendProfile: FrontendStudentProfile = {
      name: profile.fullName,
      email: userRow?.email,
      degree: profile.degree || 'B.Tech',
      department: profile.department || 'Computer Engg (CSE)',
      cgpa: cgpaNum ?? 0,
      gradYear: profile.graduationYear ?? 2027,
      activeBacklogs: profile.activeBacklogs ?? 0,
      collegeName: profile.college || 'National Institute of Engineering',
      readinessScore: Math.round(readiness.overall),
      profileCompletion: completion.pct,
      targetRole: profile.targetRole || 'Software Engineer (SDE-1)',
      avatarUrl: profile.avatarUrl || '',
      avatarBg: profile.avatarBg || 'indigo',
      skills: stuSkillsRows.map((s) => s.name),
      certifications: profile.certifications.map(
        (c) => `${c.name}${c.issuer ? ` (${c.issuer})` : ''}`
      ),
      projects: profile.projects.map((p) => ({
        id: p.id,
        title: p.title,
        stack: (p.technologies || []).join(', '),
        impact: p.description || '',
      })),
      leetcodeSolved: profile.leetcodeSolved ?? 0,
      resumeSummary:
        profile.resumeSummary ||
        profile.bio ||
        'B.Tech candidate focused on software engineering, data structures, and system design.',
    };

    const {
      user: _u,
      skills: _sk,
      projects: projectRows,
      certifications: certRows,
      internships: internRows,
      achievements: achRows,
      preferences: prefRow,
      academicRecords: acadRows,
      resumes: resumeRows,
      ...scalarProfile
    } = profile;

    return {
      user: userRow
        ? {
            id: userRow.id,
            email: userRow.email,
            role: userRow.role,
            isActive: userRow.isActive,
          }
        : null,
      profile: {
        ...scalarProfile,
        cgpa: cgpaNum,
        tenthPct: tenthNum,
        twelfthPct: twelfthNum,
        diplomaPct: diplomaNum,
        completionPct: completion.pct,
      },
      completion: {
        ...completion,
        completionPct: completion.pct,
      },
      readiness,
      skills: stuSkillsRows,
      projects: projectRows,
      certifications: certRows,
      internships: internRows,
      achievements: achRows,
      preferences: prefRow || {
        studentId,
        preferredRoles: [],
        preferredIndustries: [],
        preferredLocations: [],
      },
      academicRecords: acadRows.map((a) => ({
        ...a,
        sgpa: toNumber(a.sgpa) ?? 0,
      })),
      resumes: resumeRows,
      portalSettings: {
        ...DEFAULT_PORTAL_SETTINGS,
        ...((profile.portalSettings as Partial<PortalSettings>) || {}),
      },
      frontendProfile,
    };
  } catch (err) {
    sanitizeDbError('loadStudentFullContext', err);
  }
}

export async function evaluateAndPersistStudentReadiness(
  studentId: string,
  persistSnapshot = false,
  preloaded?: {
    profile?: {
      userId: string;
      cgpa: unknown;
      tenthPct: unknown;
      twelfthPct: unknown;
      diplomaPct: unknown;
      activeBacklogs: number;
      totalBacklogs: number;
      completionPct: number;
    };
    stuSkillProficiencies?: number[];
    projectRows?: {
      description: string | null;
      technologies: string[];
      githubUrl: string | null;
    }[];
  }
): Promise<ReadinessEvaluation> {
  try {
    const [
      profile,
      stuSkillRows,
      allTopics,
      progressRows,
      attemptRows,
      problemRows,
      submissionRows,
      sessionRows,
      projectRows,
    ] = await Promise.all([
      preloaded?.profile
        ? Promise.resolve(preloaded.profile)
        : prisma.studentProfile.findUnique({ where: { id: studentId } }),
      preloaded?.stuSkillProficiencies
        ? Promise.resolve(preloaded.stuSkillProficiencies.map((proficiency) => ({ proficiency })))
        : prisma.studentSkill.findMany({ where: { studentId }, select: { proficiency: true } }),
      prisma.preparationTopic.findMany({ where: { isActive: true } }),
      prisma.studentProgress.findMany({ where: { studentId } }),
      prisma.quizAttempt.findMany({
        where: { studentId },
        orderBy: { startedAt: 'asc' },
      }),
      prisma.codingProblem.findMany({ where: { isActive: true } }),
      prisma.codingSubmission.findMany({ where: { studentId } }),
      prisma.interviewSession.findMany({
        where: { studentId },
        include: { answers: true },
      }),
      preloaded?.projectRows
        ? Promise.resolve(preloaded.projectRows)
        : prisma.project.findMany({ where: { studentId } }),
    ]);

    if (!profile) {
      return computeReadiness({
        academics: {},
        technical: {
          skillsProficiencies: [],
          completedTechnicalTopics: 0,
          totalTechnicalTopics: 0,
          hasAnyTopicActivity: false,
        },
        aptitude: { attemptsByCategory: {} },
        coding: { totalSubmissions: 0, problems: [] },
        interview: { reviewedQuestions: 0, completedSessions: 0, hasActivity: false },
        projects: { items: [] },
      });
    }

    const answerRows = sessionRows.flatMap((s) => s.answers);

    const technicalTopics = allTopics.filter(
      (t) => !['aptitude', 'hr', 'behavioral'].some((kw) => t.category.toLowerCase().includes(kw))
    );
    const completedTopicSet = new Set(
      progressRows.filter((p) => p.status === 'COMPLETED').map((p) => p.topicId)
    );
    const completedTechCount = technicalTopics.filter((t) => completedTopicSet.has(t.id)).length;

    const attemptsByCategory: Record<string, number[]> = {};
    const finishedAttempts = attemptRows.filter(
      (a) => (a.status === 'SUBMITTED' || a.status === 'EXPIRED') && a.total > 0 && a.score !== null
    );
    for (const att of finishedAttempts) {
      const cat = att.category || 'GENERAL';
      const pct = Math.round(((att.score ?? 0) / att.total) * 100);
      if (!attemptsByCategory[cat]) attemptsByCategory[cat] = [];
      attemptsByCategory[cat].push(pct);
    }

    const solvedProblemIds = new Set(
      submissionRows
        .filter((s) => s.status === 'PASSED' || s.status === 'SELF_MARKED_SOLVED')
        .map((s) => s.problemId)
    );

    const readiness = computeReadiness({
      academics: {
        cgpa: toNumber(profile.cgpa as number | string | null),
        tenthPct: toNumber(profile.tenthPct as number | string | null),
        twelfthPct: toNumber(profile.twelfthPct as number | string | null),
        diplomaPct: toNumber(profile.diplomaPct as number | string | null),
        activeBacklogs: profile.activeBacklogs,
        totalBacklogs: profile.totalBacklogs,
      },
      technical: {
        skillsProficiencies: stuSkillRows.map((s) => s.proficiency),
        completedTechnicalTopics: completedTechCount,
        totalTechnicalTopics: technicalTopics.length,
        hasAnyTopicActivity: progressRows.some((p) => p.status !== 'NOT_STARTED'),
      },
      aptitude: {
        attemptsByCategory,
      },
      coding: {
        totalSubmissions: submissionRows.length,
        problems: problemRows.map((p) => ({
          id: p.id,
          difficulty: p.difficulty,
          isSolved: solvedProblemIds.has(p.id),
        })),
      },
      interview: {
        reviewedQuestions: answerRows.filter((a) => a.reviewed).length,
        completedSessions: sessionRows.filter((s) => Boolean(s.completedAt)).length,
        hasActivity: sessionRows.length > 0 || answerRows.length > 0,
      },
      projects: {
        items: projectRows.map((p) => ({
          description: p.description,
          technologies: p.technologies || [],
          githubUrl: p.githubUrl,
        })),
      },
    });

    if (persistSnapshot) {
      await prisma.readinessSnapshot.create({
        data: {
          studentId,
          overall: readiness.overall.toFixed(2),
          academics:
            readiness.categories.academics !== null
              ? readiness.categories.academics.toFixed(2)
              : null,
          technical:
            readiness.categories.technical !== null
              ? readiness.categories.technical.toFixed(2)
              : null,
          aptitude:
            readiness.categories.aptitude !== null
              ? readiness.categories.aptitude.toFixed(2)
              : null,
          coding:
            readiness.categories.coding !== null ? readiness.categories.coding.toFixed(2) : null,
          interview:
            readiness.categories.interview !== null
              ? readiness.categories.interview.toFixed(2)
              : null,
          projects:
            readiness.categories.projects !== null
              ? readiness.categories.projects.toFixed(2)
              : null,
          isProvisional: readiness.isProvisional,
          coveragePct: readiness.coveragePct,
          missing: readiness.missing,
        },
      });
    }

    await evaluateAndAwardBadges({
      studentId,
      userId: profile.userId,
      completionPct: profile.completionPct,
      finishedQuizPcts: finishedAttempts.map((a) => ((a.score ?? 0) / a.total) * 100),
      solvedCodingCount: solvedProblemIds.size,
      totalCodingSubmissions: submissionRows.length,
      completedTopicsCount: completedTopicSet.size,
      completedInterviewCount: sessionRows.filter((s) => Boolean(s.completedAt)).length,
    });

    return readiness;
  } catch (err) {
    sanitizeDbError('evaluateAndPersistStudentReadiness', err);
  }
}

export async function evaluateAndAwardBadges(params: {
  studentId: string;
  userId: string;
  completionPct: number;
  finishedQuizPcts: number[];
  solvedCodingCount: number;
  totalCodingSubmissions: number;
  completedTopicsCount: number;
  completedInterviewCount: number;
}) {
  const qualifiedCodes: string[] = [];
  if (params.finishedQuizPcts.length >= 1) qualifiedCodes.push('FIRST_QUIZ');
  if (params.finishedQuizPcts.filter((p) => p >= 80).length >= 5) qualifiedCodes.push('QUIZ_MASTER');
  if (params.totalCodingSubmissions >= 1) qualifiedCodes.push('FIRST_CODE');
  if (params.solvedCodingCount >= 5) qualifiedCodes.push('FIVE_PROBLEMS');
  if (params.completedTopicsCount >= 10) qualifiedCodes.push('TEN_TOPICS');
  if (params.completionPct >= 80) qualifiedCodes.push('PROFILE_80');
  if (params.completionPct >= 100) qualifiedCodes.push('PROFILE_100');
  if (params.completedInterviewCount >= 1) qualifiedCodes.push('MOCK_INTERVIEWER');

  if (qualifiedCodes.length === 0) return;

  const [badgeRows, existingStudentBadges] = await Promise.all([
    prisma.badge.findMany({ where: { code: { in: qualifiedCodes } } }),
    prisma.studentBadge.findMany({ where: { studentId: params.studentId } }),
  ]);

  const ownedBadgeIds = new Set(existingStudentBadges.map((b) => b.badgeId));
  const newlyEarned = badgeRows.filter((b) => !ownedBadgeIds.has(b.id));
  if (newlyEarned.length === 0) return;

  await prisma.studentBadge.createMany({
    data: newlyEarned.map((badge) => ({
      studentId: params.studentId,
      badgeId: badge.id,
    })),
    skipDuplicates: true,
  });

  await prisma.notification.createMany({
    data: newlyEarned.map((badge) => ({
      userId: params.userId,
      type: 'ACHIEVEMENT',
      title: `Milestone Unlocked: ${badge.name}`,
      body: badge.description,
    })),
  });
}

export async function mapCompaniesToFrontendDrives(
  studentId?: string,
  preloaded?: {
    roles?: Awaited<ReturnType<typeof loadCandidateRolesFromDb>>['roles'];
    recCtx?: StudentRecommendationContext | null;
  }
): Promise<CompanyDrive[]> {
  const roles = preloaded?.roles ?? (await loadCandidateRolesFromDb(false)).roles;
  if (roles.length === 0) return [];

  const primaryRoleByComp = new Map<string, (typeof roles)[number]>();
  for (const r of roles) {
    if (!primaryRoleByComp.has(r.companyId)) {
      primaryRoleByComp.set(r.companyId, r);
    }
  }
  const primaryRoles = Array.from(primaryRoleByComp.values());

  if (!studentId) {
    return primaryRoles.map((r) => ({
      id: r.companySlug || r.companyId,
      name: r.companyName,
      logoIcon: r.logoIcon,
      role: r.roleTitle,
      category: r.category,
      matchScore: 75,
      location: r.location,
      packageLpa: r.packageInfo,
      driveDate: r.driveDate,
      daysRemaining: r.daysRemaining,
      isEligible: true,
      minCgpa: r.requirement?.minCgpa ?? 7.0,
      allowedBacklogs: r.requirement?.maxActiveBacklogs ?? 0,
      allowedBranches: r.requirement?.allowedBranches?.length
        ? r.requirement.allowedBranches
        : ['CSE', 'IT', 'ECE'],
      matchedSkills: r.requiredSkills.slice(0, 3).map((s) => s.name),
      gapSkills: r.requiredSkills.slice(3).map((s) => s.name),
      hiringFunnel:
        r.stages.length > 0
          ? r.stages.map((s) => `${s.stageOrder}. ${s.name}`)
          : ['1. Online Assessment', '2. Technical Interview', '3. HR Round'],
      institutionalNotes: r.institutionalNotes,
    }));
  }

  const ctx =
    preloaded?.recCtx !== undefined
      ? preloaded.recCtx
      : await loadStudentRecommendationContext(studentId);
  if (!ctx) return mapCompaniesToFrontendDrives(undefined, { roles });

  const studentRecInput = {
    academics: {
      cgpa: ctx.profile.cgpa,
      tenthPct: ctx.profile.tenthPct,
      twelfthPct: ctx.profile.twelfthPct,
      diplomaPct: ctx.profile.diplomaPct,
      department: ctx.profile.department,
      activeBacklogs: ctx.profile.activeBacklogs,
      totalBacklogs: ctx.profile.totalBacklogs,
      graduationYear: ctx.profile.graduationYear,
    },
    skills: ctx.skills.map((s) => ({
      id: s.skillId,
      name: s.name,
      category: s.category,
      aliases: s.aliases || [],
    })),
    projects: ctx.projects.map((p) => ({
      title: p.title,
      description: p.description,
      technologies: p.technologies || [],
    })),
    certifications: ctx.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
    })),
  };

  const recOut = computeRecommendations(studentRecInput, primaryRoles);
  const recByRoleId = new Map(recOut.items.map((i) => [i.jobRoleId, i]));

  return primaryRoles.map((r) => {
    const rec = recByRoleId.get(r.jobRoleId);
    const elig = evaluateEligibility(studentRecInput.academics, r.requirement);
    return {
      id: r.companySlug || r.companyId,
      name: r.companyName,
      logoIcon: r.logoIcon,
      role: r.roleTitle,
      category: r.category,
      matchScore: Math.round(rec?.matchScore ?? 72),
      location: r.location,
      packageLpa: r.packageInfo,
      driveDate: r.driveDate,
      daysRemaining: r.daysRemaining,
      isEligible: elig.status === 'ELIGIBLE',
      minCgpa: r.requirement?.minCgpa ?? 7.0,
      allowedBacklogs: r.requirement?.maxActiveBacklogs ?? 0,
      allowedBranches: r.requirement?.allowedBranches?.length
        ? r.requirement.allowedBranches
        : ['CSE', 'IT', 'ECE'],
      matchedSkills: rec?.matchingSkills ?? [],
      gapSkills: rec?.missingSkills ?? [],
      hiringFunnel:
        r.stages.length > 0
          ? r.stages.map((s) => `${s.stageOrder}. ${s.name}`)
          : ['1. Online Assessment', '2. Technical Interview', '3. HR Round'],
      institutionalNotes:
        r.dataStatus === 'SAMPLE'
          ? `${r.institutionalNotes ? `${r.institutionalNotes} ` : ''}[Sample Campus Criteria]`
          : r.institutionalNotes,
    };
  });
}

export async function loadStudentFrontendApplications(
  studentId: string
): Promise<ApplicationRecord[]> {
  try {
    const rows = await prisma.driveApplication.findMany({
      where: { studentId },
      include: {
        company: true,
        jobRole: true,
      },
      orderBy: { appliedAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      companyId: r.company.slug || r.company.id,
      company: r.company.name,
      role: r.jobRole?.title || 'Software Engineer',
      packageLpa: r.company.packageInfo || 'TBD',
      status: (r.status as ApplicationStatus) || 'Applied',
      date:
        r.company.driveDate ||
        new Date(r.appliedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      round: r.round || '1. Initial Screening',
      notes: r.notes || '',
    }));
  } catch (err) {
    sanitizeDbError('loadStudentFrontendApplications', err);
  }
}

export async function loadStudentStudyModules(
  studentId: string,
  preloaded?: {
    topics?: {
      id: string;
      week: number | null;
      dayRange: string | null;
      title: string;
      category: string;
      sequenceOrder: number;
      estimatedHours: unknown;
    }[];
    progRows?: { topicId: string; status: string }[];
  }
): Promise<StudyPlanModule[]> {
  try {
    const [topics, progRows] = await Promise.all([
      preloaded?.topics
        ? Promise.resolve(
            [...preloaded.topics].sort(
              (a, b) => (a.week ?? 1) - (b.week ?? 1) || a.sequenceOrder - b.sequenceOrder
            )
          )
        : prisma.preparationTopic.findMany({
            where: { isActive: true },
            orderBy: [{ week: 'asc' }, { sequenceOrder: 'asc' }],
          }),
      preloaded?.progRows
        ? Promise.resolve(preloaded.progRows)
        : prisma.studentProgress.findMany({ where: { studentId } }),
    ]);

    const completedIds = new Set(
      progRows.filter((p) => p.status === 'COMPLETED').map((p) => p.topicId)
    );

    return topics.slice(0, 18).map((t) => ({
      id: t.id,
      week: Math.min(3, Math.max(1, t.week || 1)) as 1 | 2 | 3,
      dayRange: t.dayRange || 'Days 1-2',
      title: t.title,
      category: t.category,
      duration: `${toNumber(t.estimatedHours as number | string | null) ?? 2} hrs`,
      completed: completedIds.has(t.id),
    }));
  } catch (err) {
    sanitizeDbError('loadStudentStudyModules', err);
  }
}

export async function loadStudentFrontendSkillGaps(
  studentId: string,
  preloaded?: {
    recCtx?: StudentRecommendationContext | null;
    roles?: Awaited<ReturnType<typeof loadCandidateRolesFromDb>>['roles'];
    topicsRows?: Awaited<ReturnType<typeof prisma.preparationTopic.findMany>>;
  }
): Promise<SkillGapItem[]> {
  const [ctx, roles, resourcesRows, topicsRows] = await Promise.all([
    preloaded?.recCtx !== undefined
      ? Promise.resolve(preloaded.recCtx)
      : loadStudentRecommendationContext(studentId),
    preloaded?.roles
      ? Promise.resolve(preloaded.roles)
      : loadCandidateRolesFromDb(false).then((r) => r.roles),
    prisma.learningResource.findMany({ where: { isActive: true } }),
    preloaded?.topicsRows
      ? Promise.resolve(preloaded.topicsRows)
      : prisma.preparationTopic.findMany({ where: { isActive: true } }),
  ]);

  if (!ctx) return [];

  const requiredPool: RequiredSkillDescriptor[] = [];
  const companiesBySkillName = new Map<string, Set<string>>();
  for (const r of roles) {
    for (const sk of r.requiredSkills) {
      requiredPool.push(sk);
      const set = companiesBySkillName.get(sk.name) || new Set<string>();
      set.add(r.companyName);
      companiesBySkillName.set(sk.name, set);
    }
  }

  const gapReport = computeSkillGap(
    ctx.skills.map((s) => ({
      id: s.skillId,
      name: s.name,
      category: s.category,
      aliases: s.aliases || [],
    })),
    requiredPool,
    resourcesRows,
    topicsRows
  );

  const missingOrPartial = gapReport.items.filter((i) => i.status !== 'HAVE').slice(0, 6);
  return missingOrPartial.map((item) => {
    const currentProf = item.status === 'PARTIAL' ? 48 : 24;
    const targetBench = item.priority === 'HIGH' ? 85 : 75;
    const priorityCap =
      item.priority === 'HIGH' ? 'High' : item.priority === 'MEDIUM' ? 'Medium' : 'Low';
    const impacted = Array.from(companiesBySkillName.get(item.skillName) || []).slice(0, 4);
    return {
      id: item.skillId,
      title: item.skillName,
      subtitle: `${item.category} Competency · ${item.importance === 'MUST' ? 'Core Requirement' : 'Preferred Skill'}`,
      priority: priorityCap,
      priorityTag: `${priorityCap} Priority`,
      moduleCategory: item.category,
      currentProficiency: currentProf,
      currentLabel: item.status === 'PARTIAL' ? 'Related Foundation' : 'Needs Practice',
      targetBenchmark: targetBench,
      targetLabel: 'Campus Benchmark',
      deficitPercentage: Math.max(10, targetBench - currentProf),
      impactedCompanies: impacted.length > 0 ? impacted : ['Campus Recruiters'],
      actionLabel: item.resources[0]?.title
        ? `Study: ${item.resources[0].title.slice(0, 24)}`
        : 'Start Practice Module',
      actionIcon: 'school',
    };
  });
}

/**
 * Builds the strictly isolated, PII-redacted `FACTS (from the database)` block for Gemini AI.
 * Scoped EXCLUSIVELY to `studentId` from verified JWT/session.
 */
export async function buildGroundedAiFactsForStudent(studentId: string): Promise<{
  factsBlock: string;
  usedFactLabels: string[];
  studentFullName: string | null;
}> {
  const ctx = await loadStudentFullContext(studentId);
  if (!ctx) {
    return {
      factsBlock: '- Profile status: Student profile not yet populated in database.',
      usedFactLabels: ['profileStatus'],
      studentFullName: null,
    };
  }

  const { roles } = await loadCandidateRolesFromDb(false);
  const recOut = computeRecommendations(
    {
      academics: {
        cgpa: ctx.profile.cgpa,
        tenthPct: ctx.profile.tenthPct,
        twelfthPct: ctx.profile.twelfthPct,
        diplomaPct: ctx.profile.diplomaPct,
        department: ctx.profile.department,
        activeBacklogs: ctx.profile.activeBacklogs,
        totalBacklogs: ctx.profile.totalBacklogs,
        graduationYear: ctx.profile.graduationYear,
      },
      skills: ctx.skills.map((s) => ({
        id: s.skillId,
        name: s.name,
        category: s.category,
        aliases: s.aliases || [],
      })),
      projects: ctx.projects.map((p) => ({
        title: p.title,
        description: p.description,
        technologies: p.technologies || [],
      })),
      certifications: ctx.certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer,
      })),
    },
    roles
  );

  const top5Recs = recOut.items
    .slice(0, 5)
    .map(
      (r) =>
        `${r.companyName} — ${r.roleTitle} [DataStatus=${r.dataStatus}, Eligibility=${r.eligibility}, RuleMatch=${r.matchScore}%, MissingSkills=${r.missingSkills.slice(0, 3).join(', ') || 'None'}]`
    );

  const gapReport = computeSkillGap(
    ctx.skills.map((s) => ({
      id: s.skillId,
      name: s.name,
      category: s.category,
      aliases: s.aliases || [],
    })),
    roles.slice(0, 5).flatMap((r) => r.requiredSkills)
  );

  const topGaps = gapReport.items
    .filter((i) => i.status !== 'HAVE')
    .slice(0, 6)
    .map((g) => `${g.skillName} (${g.status}, Priority=${g.priority})`);

  const [progRows, topicsCount] = await Promise.all([
    prisma.studentProgress.findMany({ where: { studentId } }),
    prisma.preparationTopic.count({ where: { isActive: true } }),
  ]);
  const completedCount = progRows.filter((p) => p.status === 'COMPLETED').length;

  const lines = [
    `- Branch / Department: ${ctx.profile.department || 'Not specified'} (Graduation Batch: ${ctx.profile.graduationYear || 'Not specified'})`,
    `- Academic CGPA Band: ${getCgpaBand(ctx.profile.cgpa)} | Active Backlogs: ${ctx.profile.activeBacklogs ?? 'Unknown'}`,
    `- Profile Completion: ${ctx.completion.pct}% (Missing sections: ${ctx.completion.missing.join(', ') || 'None'})`,
    `- Verified Skills (${ctx.skills.length}): ${ctx.skills.map((s) => `${s.name} (L${s.proficiency}/5)`).join(', ') || 'None recorded'}`,
    `- Readiness Indicator: ${ctx.readiness.overall}% (${ctx.readiness.isProvisional ? 'PROVISIONAL' : 'FULL'}, Coverage=${ctx.readiness.coveragePct}%, Missing=${ctx.readiness.missing.join(', ') || 'None'})`,
    `- Readiness Breakdown: Academics=${ctx.readiness.categories.academics ?? 'N/A'}, Technical=${ctx.readiness.categories.technical ?? 'N/A'}, Aptitude=${ctx.readiness.categories.aptitude ?? 'N/A'}, Coding=${ctx.readiness.categories.coding ?? 'N/A'}, Interview=${ctx.readiness.categories.interview ?? 'N/A'}, Projects=${ctx.readiness.categories.projects ?? 'N/A'}`,
    `- Preparation Topic Progress: ${completedCount}/${topicsCount} topics completed`,
    `- Top 5 Rule-Based Role Evaluations: ${top5Recs.join(' | ') || 'None available'}`,
    `- Priority Skill Gaps: ${topGaps.join(', ') || 'None identified'}`,
  ];

  return {
    factsBlock: lines.join('\n'),
    usedFactLabels: [
      'branch',
      'cgpaBand',
      'profileCompletion',
      'skills',
      'readiness',
      'topicProgress',
      'topRecommendations',
      'skillGaps',
    ],
    studentFullName: ctx.profile.fullName,
  };
}
