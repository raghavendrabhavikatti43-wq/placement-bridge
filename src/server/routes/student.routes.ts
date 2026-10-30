import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma, Prisma } from '../../db/prisma.ts';
import { recalculateAndPersistProfileCompletion } from '../../db/users.ts';
import {
  createSignedFileUrl,
  deleteStoredFile,
  readStoredFileBuffer,
  validateAndStoreFile,
  verifySignedFileUrl,
} from '../integrations/storage.ts';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { uploadRateLimiter, validateBody } from '../middleware/security.ts';
import {
  evaluateAndPersistStudentReadiness,
  loadStudentFullContext,
} from '../services/studentDataService.ts';
import { AppError, asyncHandler, sanitizeDbError } from '../utils/errors.ts';
import { sendSuccess } from '../utils/response.ts';

export const studentRouter = Router();

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(32).nullable().optional(),
    college: z.string().trim().max(160).nullable().optional(),
    collegeName: z.string().trim().max(160).nullable().optional(),
    degree: z.string().trim().max(60).optional(),
    department: z.string().trim().max(120).nullable().optional(),
    semester: z.coerce.number().int().min(1).max(8).nullable().optional(),
    graduationYear: z.coerce.number().int().min(2020).max(2035).nullable().optional(),
    gradYear: z.coerce.number().int().min(2020).max(2035).nullable().optional(),
    tenthPct: z.coerce.number().min(0).max(100).nullable().optional(),
    twelfthPct: z.coerce.number().min(0).max(100).nullable().optional(),
    diplomaPct: z.coerce.number().min(0).max(100).nullable().optional(),
    cgpa: z.coerce.number().min(0).max(10).nullable().optional(),
    totalBacklogs: z.coerce.number().int().min(0).max(50).nullable().optional(),
    activeBacklogs: z.coerce.number().int().min(0).max(50).nullable().optional(),
    targetRole: z.string().trim().max(120).optional(),
    leetcodeSolved: z.coerce.number().int().min(0).max(5000).optional(),
    avatarUrl: z.string().max(500_000).optional(),
    avatarBg: z.string().trim().max(40).optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    resumeSummary: z.string().trim().max(4000).nullable().optional(),
    portalSettings: z.record(z.string(), z.unknown()).optional(),
    academicRecords: z
      .array(
        z.object({
          semester: z.coerce.number().int().min(1).max(8),
          sgpa: z.coerce.number().min(0).max(10),
          backlogsInSemester: z.coerce.number().int().min(0).max(20).default(0),
        })
      )
      .max(8)
      .optional(),
    skillsList: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  })
  .refine(
    (data) => {
      if (
        data.totalBacklogs !== undefined &&
        data.totalBacklogs !== null &&
        data.activeBacklogs !== undefined &&
        data.activeBacklogs !== null
      ) {
        return data.totalBacklogs >= data.activeBacklogs;
      }
      return true;
    },
    {
      message: 'totalBacklogs must be greater than or equal to activeBacklogs',
      path: ['totalBacklogs'],
    }
  );

const addSkillSchema = z.object({
  skillId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  category: z
    .enum(['LANGUAGE', 'FRAMEWORK', 'DATABASE', 'TOOL', 'TECHNICAL', 'SOFT'])
    .default('TECHNICAL'),
  proficiency: z.coerce.number().int().min(1).max(5).default(3),
});

const updateSkillProficiencySchema = z.object({
  proficiency: z.coerce.number().int().min(1).max(5),
});

const projectSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  technologies: z.array(z.string().trim().max(60)).max(25).default([]),
  role: z.string().trim().max(120).nullable().optional(),
  githubUrl: z.string().trim().max(300).nullable().optional(),
});

const certificationSchema = z.object({
  name: z.string().trim().min(2).max(180),
  issuer: z.string().trim().min(1).max(140).default('Verified Credential'),
  credentialUrl: z.string().trim().max(300).nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
});

const internshipSchema = z.object({
  company: z.string().trim().min(2).max(160),
  role: z.string().trim().min(2).max(140),
  description: z.string().trim().max(2000).nullable().optional(),
});

const achievementSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1500).nullable().optional(),
});

const preferencesSchema = z.object({
  preferredRoles: z.array(z.string().trim().max(100)).max(20).default([]),
  preferredIndustries: z.array(z.string().trim().max(100)).max(20).default([]),
  preferredLocations: z.array(z.string().trim().max(100)).max(20).default([]),
});

// ============================================================================
// STUDENT PROFILE & COMPLETION
// ============================================================================
studentRouter.get(
  '/students/me',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const ctx = await loadStudentFullContext(studentId);
    if (!ctx) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');
    }
    return sendSuccess(res, ctx);
  })
);

studentRouter.put(
  '/students/me',
  authenticate,
  requireRole('STUDENT'),
  validateBody(updateProfileSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const body = req.body;

    try {
      const current = await prisma.studentProfile.findUnique({
        where: { id: studentId },
      });
      if (!current) {
        throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');
      }

      const nextActiveBacklogs =
        body.activeBacklogs !== undefined ? body.activeBacklogs : current.activeBacklogs ?? 0;
      let nextTotalBacklogs =
        body.totalBacklogs !== undefined ? body.totalBacklogs : current.totalBacklogs ?? 0;
      if (
        nextTotalBacklogs !== null &&
        nextActiveBacklogs !== null &&
        nextTotalBacklogs < nextActiveBacklogs
      ) {
        if (body.totalBacklogs !== undefined) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'totalBacklogs must be greater than or equal to activeBacklogs',
            [{ field: 'totalBacklogs', message: 'Cannot be less than activeBacklogs' }]
          );
        }
        nextTotalBacklogs = nextActiveBacklogs;
      }

      const updateFields: Prisma.StudentProfileUpdateInput = { updatedAt: new Date() };
      const resolvedName = body.fullName ?? body.name;
      if (resolvedName !== undefined) updateFields.fullName = resolvedName;
      if (body.phone !== undefined) updateFields.phone = body.phone;
      const resolvedCollege = body.college ?? body.collegeName;
      if (resolvedCollege !== undefined) updateFields.college = resolvedCollege;
      if (body.degree !== undefined) updateFields.degree = body.degree;
      if (body.department !== undefined) updateFields.department = body.department;
      if (body.semester !== undefined) updateFields.semester = body.semester;
      const resolvedGradYear = body.graduationYear ?? body.gradYear;
      if (resolvedGradYear !== undefined) updateFields.graduationYear = resolvedGradYear;
      if (body.tenthPct !== undefined)
        updateFields.tenthPct = body.tenthPct !== null ? Number(body.tenthPct).toFixed(2) : null;
      if (body.twelfthPct !== undefined)
        updateFields.twelfthPct =
          body.twelfthPct !== null ? Number(body.twelfthPct).toFixed(2) : null;
      if (body.diplomaPct !== undefined)
        updateFields.diplomaPct =
          body.diplomaPct !== null ? Number(body.diplomaPct).toFixed(2) : null;
      if (body.cgpa !== undefined)
        updateFields.cgpa = body.cgpa !== null ? Number(body.cgpa).toFixed(2) : null;
      if (body.activeBacklogs !== undefined) updateFields.activeBacklogs = nextActiveBacklogs;
      if (body.totalBacklogs !== undefined || nextTotalBacklogs !== current.totalBacklogs)
        updateFields.totalBacklogs = nextTotalBacklogs;
      if (body.targetRole !== undefined) updateFields.targetRole = body.targetRole;
      if (body.leetcodeSolved !== undefined) updateFields.leetcodeSolved = body.leetcodeSolved;
      if (body.avatarUrl !== undefined) updateFields.avatarUrl = body.avatarUrl;
      if (body.avatarBg !== undefined) updateFields.avatarBg = body.avatarBg;
      if (body.bio !== undefined) updateFields.bio = body.bio;
      if (body.resumeSummary !== undefined) updateFields.resumeSummary = body.resumeSummary;
      if (body.portalSettings !== undefined)
        updateFields.portalSettings = body.portalSettings as Prisma.InputJsonValue;

      await prisma.studentProfile.update({
        where: { id: studentId },
        data: updateFields,
      });

      if (Array.isArray(body.academicRecords)) {
        for (const rec of body.academicRecords) {
          await prisma.academicRecord.upsert({
            where: {
              studentId_semester: {
                studentId,
                semester: rec.semester,
              },
            },
            create: {
              studentId,
              semester: rec.semester,
              sgpa: Number(rec.sgpa).toFixed(2),
              backlogsInSemester: rec.backlogsInSemester ?? 0,
            },
            update: {
              sgpa: Number(rec.sgpa).toFixed(2),
              backlogsInSemester: rec.backlogsInSemester ?? 0,
            },
          });
        }
      }

      if (Array.isArray(body.skillsList)) {
        for (const rawSkillName of body.skillsList) {
          const cleanName = rawSkillName.trim();
          if (!cleanName) continue;
          const existingSkill = await prisma.skill.findFirst({
            where: { name: { equals: cleanName, mode: 'insensitive' } },
          });
          const skillRow =
            existingSkill ||
            (await prisma.skill.upsert({
              where: { name: cleanName },
              create: { name: cleanName, category: 'TECHNICAL' },
              update: {},
            }));
          await prisma.studentSkill.upsert({
            where: {
              studentId_skillId: {
                studentId,
                skillId: skillRow.id,
              },
            },
            create: { studentId, skillId: skillRow.id, proficiency: 3 },
            update: {},
          });
        }
      }

      await prisma.learningActivityLog.create({
        data: {
          studentId,
          type: 'PROFILE_UPDATED',
          refId: studentId,
        },
      });

      await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
      await evaluateAndPersistStudentReadiness(studentId, true);

      const updatedCtx = await loadStudentFullContext(studentId);
      return sendSuccess(res, updatedCtx, 'Profile updated');
    } catch (err) {
      sanitizeDbError('students.updateMe', err);
    }
  })
);

studentRouter.get(
  '/students/me/completion',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const completion = await recalculateAndPersistProfileCompletion(
      req.auth!.studentId!,
      req.auth!.userId
    );
    return sendSuccess(res, completion);
  })
);

// ============================================================================
// SKILLS CATALOGUE & STUDENT SKILLS
// ============================================================================
studentRouter.get(
  '/skills',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

    try {
      const all = await prisma.skill.findMany({ orderBy: { name: 'asc' } });
      const filtered = all.filter((s) => {
        if (category && s.category !== category) return false;
        if (q) {
          const ql = q.toLowerCase();
          const inAliases = (s.aliases || []).some((a) => a.toLowerCase().includes(ql));
          return s.name.toLowerCase().includes(ql) || inAliases;
        }
        return true;
      });
      return sendSuccess(res, filtered);
    } catch (err) {
      sanitizeDbError('skills.list', err);
    }
  })
);

studentRouter.get(
  '/students/me/skills',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.studentSkill.findMany({
      where: { studentId: req.auth!.studentId! },
      include: { skill: true },
    });
    return sendSuccess(
      res,
      rows.map((r) => ({
        skillId: r.skillId,
        proficiency: r.proficiency,
        addedAt: r.addedAt,
        name: r.skill.name,
        category: r.skill.category,
      }))
    );
  })
);

studentRouter.post(
  '/students/me/skills',
  authenticate,
  requireRole('STUDENT'),
  validateBody(addSkillSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const { skillId, name, category, proficiency } = req.body;

    if (!skillId && !name) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Either skillId or skill name is required.');
    }

    try {
      let resolvedSkillId = skillId;
      if (!resolvedSkillId && name) {
        const cleanName = name.trim();
        const found = await prisma.skill.findFirst({
          where: { name: { equals: cleanName, mode: 'insensitive' } },
        });
        if (found) {
          resolvedSkillId = found.id;
        } else {
          const created = await prisma.skill.create({
            data: { name: cleanName, category },
          });
          resolvedSkillId = created.id;
        }
      }

      await prisma.studentSkill.upsert({
        where: {
          studentId_skillId: {
            studentId,
            skillId: resolvedSkillId!,
          },
        },
        create: {
          studentId,
          skillId: resolvedSkillId!,
          proficiency,
        },
        update: {
          proficiency,
        },
      });

      const completion = await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
      return sendSuccess(
        res,
        { skillId: resolvedSkillId, proficiency, completionPct: completion.pct },
        'Skill saved',
        201
      );
    } catch (err) {
      sanitizeDbError('students.addSkill', err);
    }
  })
);

studentRouter.put(
  '/students/me/skills/:skillId',
  authenticate,
  requireRole('STUDENT'),
  validateBody(updateSkillProficiencySchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const skillId = String(req.params.skillId);
    const existing = await prisma.studentSkill.findUnique({
      where: {
        studentId_skillId: {
          studentId,
          skillId,
        },
      },
    });
    if (!existing) {
      throw new AppError(404, 'SKILL_NOT_FOUND', 'Skill is not linked to your profile.');
    }
    const updated = await prisma.studentSkill.update({
      where: {
        studentId_skillId: {
          studentId,
          skillId,
        },
      },
      data: { proficiency: req.body.proficiency },
    });
    return sendSuccess(res, updated, 'Proficiency updated');
  })
);

studentRouter.delete(
  '/students/me/skills/:skillId',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const skillId = String(req.params.skillId);
    await prisma.studentSkill.deleteMany({
      where: { studentId, skillId },
    });
    const completion = await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, { deleted: true, completionPct: completion.pct }, 'Skill removed');
  })
);

// ============================================================================
// PROJECTS, CERTIFICATIONS, INTERNSHIPS, ACHIEVEMENTS, PREFERENCES (STRICT OWNERSHIP)
// ============================================================================
studentRouter.get(
  '/students/me/projects',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.project.findMany({
      where: { studentId: req.auth!.studentId! },
    });
    return sendSuccess(res, rows);
  })
);

studentRouter.post(
  '/students/me/projects',
  authenticate,
  requireRole('STUDENT'),
  validateBody(projectSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const created = await prisma.project.create({
      data: {
        studentId,
        title: req.body.title,
        description: req.body.description ?? null,
        technologies: req.body.technologies ?? [],
        role: req.body.role ?? null,
        githubUrl: req.body.githubUrl ?? null,
      },
    });
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, created, 'Project added', 201);
  })
);

studentRouter.put(
  '/students/me/projects/:id',
  authenticate,
  requireRole('STUDENT'),
  validateBody(projectSchema.partial()),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    const existing = await prisma.project.findFirst({
      where: { id, studentId },
    });
    if (!existing) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }
    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.technologies !== undefined ? { technologies: req.body.technologies } : {}),
        ...(req.body.role !== undefined ? { role: req.body.role } : {}),
        ...(req.body.githubUrl !== undefined ? { githubUrl: req.body.githubUrl } : {}),
      },
    });
    return sendSuccess(res, updated, 'Project updated');
  })
);

studentRouter.delete(
  '/students/me/projects/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    const deleted = await prisma.project.deleteMany({
      where: { id, studentId },
    });
    if (deleted.count === 0) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, { deleted: true }, 'Project deleted');
  })
);

studentRouter.get(
  '/students/me/certifications',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.certification.findMany({
      where: { studentId: req.auth!.studentId! },
    });
    return sendSuccess(res, rows);
  })
);

studentRouter.post(
  '/students/me/certifications',
  authenticate,
  requireRole('STUDENT'),
  validateBody(certificationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const created = await prisma.certification.create({
      data: {
        studentId,
        name: req.body.name,
        issuer: req.body.issuer,
        credentialUrl: req.body.credentialUrl ?? null,
        fileId: req.body.fileId ?? null,
      },
    });
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, created, 'Certification added', 201);
  })
);

studentRouter.put(
  '/students/me/certifications/:id',
  authenticate,
  requireRole('STUDENT'),
  validateBody(certificationSchema.partial()),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    const existing = await prisma.certification.findFirst({
      where: { id, studentId },
    });
    if (!existing) throw new AppError(404, 'CERTIFICATION_NOT_FOUND', 'Certification not found.');
    const updated = await prisma.certification.update({
      where: { id },
      data: {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.issuer !== undefined ? { issuer: req.body.issuer } : {}),
        ...(req.body.credentialUrl !== undefined ? { credentialUrl: req.body.credentialUrl } : {}),
        ...(req.body.fileId !== undefined ? { fileId: req.body.fileId } : {}),
      },
    });
    return sendSuccess(res, updated, 'Certification updated');
  })
);

studentRouter.delete(
  '/students/me/certifications/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    const deleted = await prisma.certification.deleteMany({
      where: { id, studentId },
    });
    if (deleted.count === 0) {
      throw new AppError(404, 'CERTIFICATION_NOT_FOUND', 'Certification not found.');
    }
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, { deleted: true }, 'Certification deleted');
  })
);

studentRouter.get(
  '/students/me/internships',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.internship.findMany({
      where: { studentId: req.auth!.studentId! },
    });
    return sendSuccess(res, rows);
  })
);

studentRouter.post(
  '/students/me/internships',
  authenticate,
  requireRole('STUDENT'),
  validateBody(internshipSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const created = await prisma.internship.create({
      data: {
        studentId,
        company: req.body.company,
        role: req.body.role,
        description: req.body.description ?? null,
      },
    });
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, created, 'Internship added', 201);
  })
);

studentRouter.put(
  '/students/me/internships/:id',
  authenticate,
  requireRole('STUDENT'),
  validateBody(internshipSchema.partial()),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    const existing = await prisma.internship.findFirst({
      where: { id, studentId },
    });
    if (!existing) throw new AppError(404, 'INTERNSHIP_NOT_FOUND', 'Internship not found.');
    const updated = await prisma.internship.update({
      where: { id },
      data: {
        ...(req.body.company !== undefined ? { company: req.body.company } : {}),
        ...(req.body.role !== undefined ? { role: req.body.role } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
      },
    });
    return sendSuccess(res, updated, 'Internship updated');
  })
);

studentRouter.delete(
  '/students/me/internships/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    const deleted = await prisma.internship.deleteMany({
      where: { id, studentId },
    });
    if (deleted.count === 0) {
      throw new AppError(404, 'INTERNSHIP_NOT_FOUND', 'Internship not found.');
    }
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, { deleted: true }, 'Internship deleted');
  })
);

studentRouter.get(
  '/students/me/achievements',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.achievement.findMany({
      where: { studentId: req.auth!.studentId! },
    });
    return sendSuccess(res, rows);
  })
);

studentRouter.post(
  '/students/me/achievements',
  authenticate,
  requireRole('STUDENT'),
  validateBody(achievementSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const created = await prisma.achievement.create({
      data: {
        studentId,
        title: req.body.title,
        description: req.body.description ?? null,
      },
    });
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, created, 'Achievement added', 201);
  })
);

studentRouter.put(
  '/students/me/achievements/:id',
  authenticate,
  requireRole('STUDENT'),
  validateBody(achievementSchema.partial()),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    const existing = await prisma.achievement.findFirst({
      where: { id, studentId },
    });
    if (!existing) throw new AppError(404, 'ACHIEVEMENT_NOT_FOUND', 'Achievement not found.');
    const updated = await prisma.achievement.update({
      where: { id },
      data: {
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
      },
    });
    return sendSuccess(res, updated, 'Achievement updated');
  })
);

studentRouter.delete(
  '/students/me/achievements/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    const deleted = await prisma.achievement.deleteMany({
      where: { id, studentId },
    });
    if (deleted.count === 0) {
      throw new AppError(404, 'ACHIEVEMENT_NOT_FOUND', 'Achievement not found.');
    }
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, { deleted: true }, 'Achievement deleted');
  })
);

studentRouter.get(
  '/students/me/preferences',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const pref = await prisma.studentPreference.findUnique({
      where: { studentId: req.auth!.studentId! },
    });
    return sendSuccess(
      res,
      pref || {
        studentId: req.auth!.studentId!,
        preferredRoles: [],
        preferredIndustries: [],
        preferredLocations: [],
      }
    );
  })
);

studentRouter.put(
  '/students/me/preferences',
  authenticate,
  requireRole('STUDENT'),
  validateBody(preferencesSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const saved = await prisma.studentPreference.upsert({
      where: { studentId },
      create: {
        studentId,
        preferredRoles: req.body.preferredRoles,
        preferredIndustries: req.body.preferredIndustries,
        preferredLocations: req.body.preferredLocations,
      },
      update: {
        preferredRoles: req.body.preferredRoles,
        preferredIndustries: req.body.preferredIndustries,
        preferredLocations: req.body.preferredLocations,
      },
    });
    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, saved, 'Preferences saved');
  })
);

// ============================================================================
// HARDENED FILE STORAGE ENDPOINTS (Part A Section 4 & Part F15)
// ============================================================================
studentRouter.post(
  '/students/me/profile-image',
  authenticate,
  requireRole('STUDENT'),
  uploadRateLimiter,
  memoryUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Please attach an image file under field "file".');
    }
    const asset = await validateAndStoreFile({
      ownerId: req.auth!.userId,
      kind: 'PROFILE_IMAGE',
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      declaredMime: req.file.mimetype,
    });
    const signed = createSignedFileUrl(asset.id, 3600);
    await prisma.studentProfile.update({
      where: { id: req.auth!.studentId! },
      data: {
        profileImageId: asset.id,
        avatarUrl: signed.signedUrl,
        updatedAt: new Date(),
      },
    });

    return sendSuccess(res, { asset, ...signed }, 'Profile image uploaded', 201);
  })
);

studentRouter.delete(
  '/students/me/profile-image',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stu = await prisma.studentProfile.findUnique({
      where: { id: req.auth!.studentId! },
    });
    if (stu?.profileImageId) {
      await deleteStoredFile(stu.profileImageId);
    }
    await prisma.studentProfile.update({
      where: { id: req.auth!.studentId! },
      data: { profileImageId: null, avatarUrl: '', updatedAt: new Date() },
    });
    return sendSuccess(res, { deleted: true }, 'Profile image removed');
  })
);

studentRouter.post(
  '/files/resume',
  authenticate,
  requireRole('STUDENT'),
  uploadRateLimiter,
  memoryUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Please attach a PDF or DOCX resume under "file".');
    }
    const asset = await validateAndStoreFile({
      ownerId: req.auth!.userId,
      kind: 'RESUME',
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      declaredMime: req.file.mimetype,
    });
    await recalculateAndPersistProfileCompletion(req.auth!.studentId!, req.auth!.userId);
    const signed = createSignedFileUrl(asset.id, 600);
    return sendSuccess(res, { asset, ...signed }, 'Resume uploaded', 201);
  })
);

studentRouter.post(
  '/files/certificate',
  authenticate,
  requireRole('STUDENT'),
  uploadRateLimiter,
  memoryUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Please attach a certificate file under "file".');
    }
    const asset = await validateAndStoreFile({
      ownerId: req.auth!.userId,
      kind: 'CERTIFICATE',
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      declaredMime: req.file.mimetype,
    });
    const signed = createSignedFileUrl(asset.id, 600);
    return sendSuccess(res, { asset, ...signed }, 'Certificate uploaded', 201);
  })
);

studentRouter.get(
  '/files/:id/url',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const asset = await prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'File asset not found.');
    }
    const isOwner = asset.ownerId === req.auth!.userId;
    const isPublicLogo = asset.kind === 'COMPANY_LOGO';
    if (!isOwner && !isPublicLogo && req.auth!.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this file.');
    }
    const signed = createSignedFileUrl(asset.id, 600);
    return sendSuccess(res, { id: asset.id, mimeType: asset.mimeType, ...signed });
  })
);

studentRouter.get(
  '/files/:id/download',
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const exp = typeof req.query.exp === 'string' ? req.query.exp : '';
    const sig = typeof req.query.sig === 'string' ? req.query.sig : '';

    const validSignature = exp && sig ? verifySignedFileUrl(id, exp, sig) : false;
    const { asset, buffer } = await readStoredFileBuffer(id);

    if (!validSignature) {
      const isOwner = Boolean(req.auth && asset.ownerId === req.auth.userId);
      const isAdmin = req.auth?.role === 'ADMIN';
      const isPublicLogo = asset.kind === 'COMPANY_LOGO';
      if (!isOwner && !isAdmin && !isPublicLogo) {
        throw new AppError(403, 'FORBIDDEN', 'Valid signed URL or owner authorization required.');
      }
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', String(buffer.length));

    const isInlineImage = asset.kind === 'PROFILE_IMAGE' || asset.kind === 'COMPANY_LOGO';
    const safeFilename = asset.originalName.replace(/["\r\n]/g, '_');
    res.setHeader(
      'Content-Disposition',
      isInlineImage
        ? `inline; filename="${safeFilename}"`
        : `attachment; filename="${safeFilename}"`
    );

    res.status(200).send(buffer);
  })
);

studentRouter.delete(
  '/files/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const asset = await prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'File asset not found.');
    }
    if (asset.ownerId !== req.auth!.userId && req.auth!.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete another user file.');
    }
    await deleteStoredFile(id);
    return sendSuccess(res, { deleted: true }, 'File deleted');
  })
);
