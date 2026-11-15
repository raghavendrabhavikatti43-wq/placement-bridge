import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.ts';
import { evaluateEligibility } from '../engines/eligibility.ts';
import { requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { AppError, asyncHandler } from '../utils/errors.ts';
import { buildPaginationMeta, parsePagination, sendSuccess } from '../utils/response.ts';

export const recruitmentRouter = Router();

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const createDriveSchema = z.object({
  companyId: z.string().uuid(),
  jobTitle: z.string().trim().min(1).max(255),
  jobDescription: z.string().trim().min(1),
  location: z.string().trim().max(255).optional(),
  ctcMin: z.number().positive().optional().nullable(),
  ctcMax: z.number().positive().optional().nullable(),
  eligibilityCriteria: z
    .object({
      minCgpa: z.number().optional().nullable(),
      minTenthPct: z.number().optional().nullable(),
      minTwelfthPct: z.number().optional().nullable(),
      allowedBranches: z.array(z.string()).optional().nullable(),
      maxActiveBacklogs: z.number().int().optional().nullable(),
      maxTotalBacklogs: z.number().int().optional().nullable(),
      graduationYear: z.number().int().optional().nullable(),
    })
    .optional()
    .nullable(),
  applicationDeadline: z.string().datetime(),
  driveDate: z.string().datetime().optional().nullable(),
  interviewDates: z.array(z.string().datetime()).optional().default([]),
});

const updateDriveSchema = createDriveSchema.partial();

const closeOrCancelDriveSchema = z.object({
  action: z.enum(['close', 'cancel']),
});

const applySchema = z.object({
  coverNote: z.string().trim().max(2000).optional(),
});

const updateApplicationStatusSchema = z.object({
  status: z.enum([
    'UNDER_REVIEW',
    'SHORTLISTED',
    'INTERVIEW_SCHEDULED',
    'SELECTED',
    'REJECTED',
  ]),
  note: z.string().trim().max(1000).optional(),
});

const createInterviewSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMins: z.number().int().min(5).max(480).default(60),
  mode: z.enum(['ONLINE', 'OFFLINE']),
  meetingLink: z.string().url().optional().nullable(),
  location: z.string().trim().max(500).optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
});

const updateInterviewSchema = createInterviewSchema.partial();

const updateNotifPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      notifType: z.enum([
        'NEW_OPPORTUNITY',
        'MATCHING_COMPANY',
        'DEADLINE_REMINDER',
        'STATUS_CHANGE',
        'INTERVIEW_SCHEDULED',
        'INTERVIEW_CHANGED',
        'INTERVIEW_CANCELLED',
        'UPCOMING_INTERVIEW',
        'ANNOUNCEMENT',
      ]),
      enabled: z.boolean(),
    })
  ),
});

// ============================================================================
// ADMIN STATUS TRANSITION RULES
// ============================================================================
const ADMIN_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'REJECTED'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED', 'SHORTLISTED'],
};

const TERMINAL_STATUSES = new Set(['SELECTED', 'REJECTED', 'WITHDRAWN']);

// ============================================================================
// BACKGROUND MATCHING HELPER
// ============================================================================
async function computeDriveMatchesInBackground(driveId: string): Promise<void> {
  try {
    // Load drive with eligibility criteria
    const drive = await prisma.placementDrive.findUnique({
      where: { id: driveId },
    });
    if (!drive) return;

    const eligibilityCriteria = drive.eligibilityCriteria as Record<string, unknown> | null;

    // Load all active students in batches of 50
    let cursor: string | undefined;
    const batchSize = 50;

    while (true) {
      const students = await prisma.studentProfile.findMany({
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where: {
          user: { isActive: true },
        },
        include: {
          user: { select: { id: true, isActive: true } },
        },
        orderBy: { id: 'asc' },
      });

      if (students.length === 0) break;
      cursor = students[students.length - 1].id;

      // For each student: call evaluateEligibility
      for (const student of students) {
        const academics = {
          cgpa: student.cgpa ? Number(student.cgpa) : null,
          tenthPct: student.tenthPct ? Number(student.tenthPct) : null,
          twelfthPct: student.twelfthPct ? Number(student.twelfthPct) : null,
          diplomaPct: student.diplomaPct ? Number(student.diplomaPct) : null,
          department: student.department,
          activeBacklogs: student.activeBacklogs,
          totalBacklogs: student.totalBacklogs,
          graduationYear: student.graduationYear,
        };

        const evalResult = evaluateEligibility(academics, eligibilityCriteria as any);

        const failingCriteria = evalResult.results
          .filter((r) => r.status === 'FAIL')
          .map((r) => r.criterion);

        const whyYouMatch = evalResult.results
          .filter((r) => r.status === 'PASS')
          .map((r) => r.explanation);

        // Upsert DriveMatch record
        await prisma.driveMatch.upsert({
          where: { driveId_studentId: { driveId, studentId: student.id } },
          create: {
            driveId,
            studentId: student.id,
            eligibilityStatus: evalResult.status,
            failingCriteria,
            whyYouMatch,
            notifiedAt: evalResult.status === 'ELIGIBLE' ? new Date() : null,
          },
          update: {
            eligibilityStatus: evalResult.status,
            failingCriteria,
            whyYouMatch,
          },
        });

        // If eligible: create PlacementNotification with dedupeKey
        if (evalResult.status === 'ELIGIBLE') {
          const dedupeKey = `new-drive-${driveId}-${student.id}`;
          await prisma.placementNotification.upsert({
            where: { dedupeKey },
            create: {
              userId: student.user.id,
              driveId,
              type: 'NEW_OPPORTUNITY',
              title: `New Placement Drive: ${drive.jobTitle}`,
              message: `A new placement opportunity matching your profile is available. Apply before the deadline!`,
              linkTarget: `/recruitment/drives/${driveId}`,
              isRead: false,
              dedupeKey,
            },
            update: {},
          });
        }
      }

      if (students.length < batchSize) break;
    }
  } catch {
    // Non-blocking — log but do not throw
  }
}

// ============================================================================
// 1. DRIVES
// ============================================================================

// POST /drives — create draft drive (admin)
recruitmentRouter.post(
  '/drives',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = createDriveSchema.parse(req.body);

    // Validate company exists
    const company = await prisma.company.findUnique({ where: { id: body.companyId } });
    if (!company) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');

    const drive = await prisma.placementDrive.create({
      data: {
        companyId: body.companyId,
        jobTitle: body.jobTitle,
        jobDescription: body.jobDescription,
        location: body.location ?? null,
        ctcMin: body.ctcMin ?? null,
        ctcMax: body.ctcMax ?? null,
        eligibilityCriteria: body.eligibilityCriteria ?? null,
        applicationDeadline: new Date(body.applicationDeadline),
        driveDate: body.driveDate ? new Date(body.driveDate) : null,
        interviewDates: body.interviewDates.map((d) => new Date(d)),
        status: 'DRAFT',
        createdById: req.auth!.userId,
      },
      include: { company: { select: { id: true, name: true, logoIcon: true } } },
    });

    return sendSuccess(res, drive, 'Placement drive created', 201);
  })
);

// PUT /drives/:id — edit drive (admin, only DRAFT drives)
recruitmentRouter.put(
  '/drives/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const body = updateDriveSchema.parse(req.body);

    const drive = await prisma.placementDrive.findUnique({ where: { id } });
    if (!drive) throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found.');
    if (drive.status !== 'DRAFT') {
      throw new AppError(
        400,
        'DRIVE_NOT_EDITABLE',
        'Only DRAFT drives can be edited.'
      );
    }

    if (body.companyId) {
      const company = await prisma.company.findUnique({ where: { id: body.companyId } });
      if (!company) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');
    }

    const updated = await prisma.placementDrive.update({
      where: { id },
      data: {
        ...(body.companyId !== undefined ? { companyId: body.companyId } : {}),
        ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle } : {}),
        ...(body.jobDescription !== undefined ? { jobDescription: body.jobDescription } : {}),
        ...(body.location !== undefined ? { location: body.location } : {}),
        ...(body.ctcMin !== undefined ? { ctcMin: body.ctcMin } : {}),
        ...(body.ctcMax !== undefined ? { ctcMax: body.ctcMax } : {}),
        ...(body.eligibilityCriteria !== undefined
          ? { eligibilityCriteria: body.eligibilityCriteria }
          : {}),
        ...(body.applicationDeadline !== undefined
          ? { applicationDeadline: new Date(body.applicationDeadline) }
          : {}),
        ...(body.driveDate !== undefined
          ? { driveDate: body.driveDate ? new Date(body.driveDate) : null }
          : {}),
        ...(body.interviewDates !== undefined
          ? { interviewDates: body.interviewDates.map((d) => new Date(d)) }
          : {}),
      },
      include: { company: { select: { id: true, name: true, logoIcon: true } } },
    });

    return sendSuccess(res, updated, 'Placement drive updated');
  })
);

// POST /drives/:id/publish — publish drive, trigger matching (admin)
recruitmentRouter.post(
  '/drives/:id/publish',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const drive = await prisma.placementDrive.findUnique({ where: { id } });
    if (!drive) throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found.');
    if (drive.status !== 'DRAFT') {
      throw new AppError(400, 'DRIVE_NOT_PUBLISHABLE', 'Only DRAFT drives can be published.');
    }

    const updated = await prisma.placementDrive.update({
      where: { id },
      data: { status: 'PUBLISHED' },
      include: { company: { select: { id: true, name: true, logoIcon: true } } },
    });

    // Trigger background matching (non-blocking)
    computeDriveMatchesInBackground(id).catch(() => undefined);

    return sendSuccess(res, updated, 'Placement drive published. Eligibility matching started.');
  })
);

// POST /drives/:id/close — close or cancel drive (admin)
recruitmentRouter.post(
  '/drives/:id/close',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const { action } = closeOrCancelDriveSchema.parse(req.body);

    const drive = await prisma.placementDrive.findUnique({ where: { id } });
    if (!drive) throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found.');
    if (drive.status === 'CANCELLED' || drive.status === 'CLOSED') {
      throw new AppError(400, 'DRIVE_ALREADY_TERMINAL', 'Drive is already closed or cancelled.');
    }

    const newStatus = action === 'cancel' ? 'CANCELLED' : 'CLOSED';
    const updated = await prisma.placementDrive.update({
      where: { id },
      data: { status: newStatus },
    });

    return sendSuccess(res, updated, `Placement drive ${newStatus.toLowerCase()}.`);
  })
);

// GET /drives — list drives
recruitmentRouter.get(
  '/drives',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const isAdmin = req.auth?.role === 'ADMIN';
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 20, 100);

    const statusFilter =
      typeof req.query.status === 'string' ? req.query.status : undefined;

    const where = isAdmin
      ? { ...(statusFilter ? { status: statusFilter as any } : {}) }
      : { status: 'PUBLISHED' as const };

    const [total, drives] = await Promise.all([
      prisma.placementDrive.count({ where }),
      prisma.placementDrive.findMany({
        where,
        orderBy: { applicationDeadline: 'asc' },
        skip: offset,
        take: pageSize,
        include: {
          company: { select: { id: true, name: true, logoIcon: true, industry: true } },
          _count: { select: { applications: true, driveMatches: true } },
        },
      }),
    ]);

    // For students: attach their DriveMatch eligibility
    const studentId = req.auth?.role === 'STUDENT' ? req.auth.studentId : undefined;
    let matchMap = new Map<string, { eligibilityStatus: string; whyYouMatch: string[]; failingCriteria: string[] }>();

    if (studentId) {
      const matches = await prisma.driveMatch.findMany({
        where: { studentId, driveId: { in: drives.map((d) => d.id) } },
        select: { driveId: true, eligibilityStatus: true, whyYouMatch: true, failingCriteria: true },
      });
      for (const m of matches) {
        matchMap.set(m.driveId, {
          eligibilityStatus: m.eligibilityStatus,
          whyYouMatch: m.whyYouMatch,
          failingCriteria: m.failingCriteria,
        });
      }
    }

    const items = drives.map((d) => ({
      ...d,
      myMatch: matchMap.get(d.id) ?? null,
    }));

    return sendSuccess(
      res,
      items,
      'Placement drives retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

// GET /drives/:id — get drive detail
recruitmentRouter.get(
  '/drives/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const isAdmin = req.auth?.role === 'ADMIN';

    const drive = await prisma.placementDrive.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, logoIcon: true, industry: true, website: true } },
        _count: { select: { applications: true } },
      },
    });

    if (!drive) throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found.');
    if (!isAdmin && drive.status !== 'PUBLISHED') {
      throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found.');
    }

    const studentId = req.auth?.role === 'STUDENT' ? req.auth.studentId : undefined;
    let myMatch = null;
    if (studentId) {
      myMatch = await prisma.driveMatch.findUnique({
        where: { driveId_studentId: { driveId: id, studentId } },
      });
    }

    return sendSuccess(res, { ...drive, myMatch });
  })
);

// ============================================================================
// 2. MATCHING
// ============================================================================

// GET /drives/:id/my-eligibility — student's eligibility for a drive
recruitmentRouter.get(
  '/drives/:id/my-eligibility',
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const driveId = String(req.params.id);
    const studentId = req.auth!.studentId!;

    const [drive, student] = await Promise.all([
      prisma.placementDrive.findUnique({ where: { id: driveId } }),
      prisma.studentProfile.findUnique({ where: { id: studentId } }),
    ]);

    if (!drive || drive.status !== 'PUBLISHED') {
      throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found.');
    }
    if (!student) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');

    const academics = {
      cgpa: student.cgpa ? Number(student.cgpa) : null,
      tenthPct: student.tenthPct ? Number(student.tenthPct) : null,
      twelfthPct: student.twelfthPct ? Number(student.twelfthPct) : null,
      diplomaPct: student.diplomaPct ? Number(student.diplomaPct) : null,
      department: student.department,
      activeBacklogs: student.activeBacklogs,
      totalBacklogs: student.totalBacklogs,
      graduationYear: student.graduationYear,
    };

    const evalResult = evaluateEligibility(
      academics,
      drive.eligibilityCriteria as any
    );

    // Also return cached DriveMatch if exists
    const cached = await prisma.driveMatch.findUnique({
      where: { driveId_studentId: { driveId, studentId } },
    });

    return sendSuccess(res, { live: evalResult, cached });
  })
);

// POST /drives/:id/recompute-matching — admin triggers re-match
recruitmentRouter.post(
  '/drives/:id/recompute-matching',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const driveId = String(req.params.id);
    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!drive) throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found.');
    if (drive.status !== 'PUBLISHED') {
      throw new AppError(400, 'DRIVE_NOT_PUBLISHED', 'Can only recompute matching for PUBLISHED drives.');
    }

    // Trigger background (non-blocking)
    computeDriveMatchesInBackground(driveId).catch(() => undefined);

    return sendSuccess(res, { driveId, triggered: true }, 'Matching recompute started.');
  })
);

// ============================================================================
// 3. APPLICATIONS
// ============================================================================

// POST /drives/:id/apply — student submits application
recruitmentRouter.post(
  '/drives/:id/apply',
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const driveId = String(req.params.id);
    const studentId = req.auth!.studentId!;
    const userId = req.auth!.userId;
    const { coverNote } = applySchema.parse(req.body);

    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!drive || drive.status !== 'PUBLISHED') {
      throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found or not open.');
    }

    // Validate deadline
    if (new Date() > drive.applicationDeadline) {
      throw new AppError(400, 'DEADLINE_PASSED', 'The application deadline for this drive has passed.');
    }

    // Check eligibility via DriveMatch
    const match = await prisma.driveMatch.findUnique({
      where: { driveId_studentId: { driveId, studentId } },
    });
    if (match && match.eligibilityStatus === 'NOT_ELIGIBLE') {
      throw new AppError(
        400,
        'NOT_ELIGIBLE',
        `You are not eligible for this drive. Failing criteria: ${match.failingCriteria.join(', ')}`
      );
    }

    // Check no duplicate application using transaction
    const application = await prisma.$transaction(async (tx) => {
      const existing = await tx.jobApplication.findFirst({
        where: { driveId, studentId, status: { not: 'WITHDRAWN' } },
      });
      if (existing) {
        throw new AppError(409, 'ALREADY_APPLIED', 'You have already applied to this drive.');
      }

      const app = await tx.jobApplication.create({
        data: {
          driveId,
          studentId,
          status: 'APPLIED',
          coverNote: coverNote ?? null,
        },
      });

      // Record initial status history
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: app.id,
          fromStatus: null as any,
          toStatus: 'APPLIED',
          actorId: userId,
          note: 'Application submitted',
        },
      });

      // Notify student of successful application
      await tx.placementNotification.create({
        data: {
          userId,
          driveId,
          type: 'STATUS_CHANGE',
          title: 'Application Submitted',
          message: `Your application for ${drive.jobTitle} has been submitted successfully.`,
          linkTarget: `/recruitment/applications`,
          isRead: false,
          dedupeKey: `applied-${app.id}`,
        },
      });

      return app;
    });

    return sendSuccess(res, application, 'Application submitted successfully.', 201);
  })
);

// POST /applications/:id/withdraw — student withdraws
recruitmentRouter.post(
  '/applications/:id/withdraw',
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const studentId = req.auth!.studentId!;
    const userId = req.auth!.userId;

    const application = await prisma.jobApplication.findFirst({
      where: { id, studentId },
      include: { drive: { select: { jobTitle: true } } },
    });

    if (!application) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }

    if (!['APPLIED', 'UNDER_REVIEW'].includes(application.status)) {
      throw new AppError(
        400,
        'CANNOT_WITHDRAW',
        'Application can only be withdrawn when in APPLIED or UNDER_REVIEW status.'
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.jobApplication.update({
        where: { id },
        data: { status: 'WITHDRAWN' },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: 'WITHDRAWN',
          actorId: userId,
          note: 'Withdrawn by student',
        },
      });

      return app;
    });

    return sendSuccess(res, updated, 'Application withdrawn.');
  })
);

// GET /applications/my — student lists own applications
recruitmentRouter.get(
  '/applications/my',
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 20, 100);

    const [total, applications] = await Promise.all([
      prisma.jobApplication.count({ where: { studentId } }),
      prisma.jobApplication.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
        include: {
          drive: {
            include: {
              company: { select: { id: true, name: true, logoIcon: true } },
            },
          },
          statusHistory: { orderBy: { createdAt: 'asc' } },
          interviews: {
            where: { status: { not: 'CANCELLED' } },
            orderBy: { scheduledAt: 'asc' },
          },
        },
      }),
    ]);

    return sendSuccess(
      res,
      applications,
      'Applications retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

// GET /drives/:id/applications — admin lists applications for a drive
recruitmentRouter.get(
  '/drives/:id/applications',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const driveId = String(req.params.id);
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 50, 200);

    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!drive) throw new AppError(404, 'DRIVE_NOT_FOUND', 'Placement drive not found.');

    const statusFilter =
      typeof req.query.status === 'string' ? req.query.status : undefined;

    const where = {
      driveId,
      ...(statusFilter ? { status: statusFilter as any } : {}),
    };

    const [total, applications] = await Promise.all([
      prisma.jobApplication.count({ where }),
      prisma.jobApplication.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: pageSize,
        include: {
          student: {
            include: {
              user: { select: { id: true, email: true } },
            },
          },
          statusHistory: { orderBy: { createdAt: 'asc' } },
          interviews: { orderBy: { scheduledAt: 'asc' } },
        },
      }),
    ]);

    return sendSuccess(
      res,
      applications,
      'Drive applications retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

// PUT /applications/:id/status — admin updates status
recruitmentRouter.put(
  '/applications/:id/status',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const { status: newStatus, note } = updateApplicationStatusSchema.parse(req.body);
    const actorId = req.auth!.userId;

    const application = await prisma.jobApplication.findUnique({
      where: { id },
      include: { drive: { select: { jobTitle: true, companyId: true } }, student: { include: { user: { select: { id: true } } } } },
    });

    if (!application) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }

    const currentStatus = application.status;

    if (TERMINAL_STATUSES.has(currentStatus)) {
      throw new AppError(
        400,
        'TERMINAL_STATUS',
        `Application is in a terminal status (${currentStatus}) and cannot be updated.`
      );
    }

    const allowedTransitions = ADMIN_ALLOWED_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new AppError(
        400,
        'INVALID_TRANSITION',
        `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${(allowedTransitions ?? []).join(', ')}`
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.jobApplication.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: currentStatus,
          toStatus: newStatus,
          actorId,
          note: note ?? null,
        },
      });

      // Notify student
      const studentUserId = application.student.user.id;
      const statusMessages: Record<string, string> = {
        UNDER_REVIEW: 'Your application is now under review.',
        SHORTLISTED: 'Congratulations! You have been shortlisted.',
        INTERVIEW_SCHEDULED: 'An interview has been scheduled for your application.',
        SELECTED: 'Congratulations! You have been selected!',
        REJECTED: 'Your application has not been progressed further.',
      };

      await tx.placementNotification.create({
        data: {
          userId: studentUserId,
          driveId: application.driveId,
          type: 'STATUS_CHANGE',
          title: `Application Status: ${newStatus.replace('_', ' ')}`,
          message: statusMessages[newStatus] ?? `Your application status has changed to ${newStatus}.`,
          linkTarget: `/recruitment/applications`,
          isRead: false,
          dedupeKey: `status-${id}-${newStatus}-${Date.now()}`,
        },
      });

      return app;
    });

    return sendSuccess(res, updated, 'Application status updated.');
  })
);

// ============================================================================
// 4. INTERVIEWS
// ============================================================================

// POST /applications/:id/interview — admin creates interview schedule
recruitmentRouter.post(
  '/applications/:id/interview',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const applicationId = String(req.params.id);
    const body = createInterviewSchema.parse(req.body);
    const actorId = req.auth!.userId;

    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { student: { include: { user: { select: { id: true } } } }, drive: { select: { jobTitle: true } } },
    });

    if (!application) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }

    if (!['SHORTLISTED', 'INTERVIEW_SCHEDULED'].includes(application.status)) {
      throw new AppError(
        400,
        'INVALID_STATUS',
        'Interview can only be scheduled for SHORTLISTED or INTERVIEW_SCHEDULED applications.'
      );
    }

    if (body.mode === 'ONLINE' && !body.meetingLink) {
      throw new AppError(400, 'MISSING_MEETING_LINK', 'Meeting link is required for ONLINE interviews.');
    }

    const interview = await prisma.$transaction(async (tx) => {
      const iv = await tx.interviewSchedule.create({
        data: {
          applicationId,
          scheduledAt: new Date(body.scheduledAt),
          durationMins: body.durationMins,
          mode: body.mode,
          meetingLink: body.meetingLink ?? null,
          location: body.location ?? null,
          instructions: body.instructions ?? null,
          status: 'SCHEDULED',
          createdById: actorId,
        },
      });

      // Update application status to INTERVIEW_SCHEDULED if currently SHORTLISTED
      if (application.status === 'SHORTLISTED') {
        await tx.jobApplication.update({
          where: { id: applicationId },
          data: { status: 'INTERVIEW_SCHEDULED' },
        });

        await tx.applicationStatusHistory.create({
          data: {
            applicationId,
            fromStatus: 'SHORTLISTED',
            toStatus: 'INTERVIEW_SCHEDULED',
            actorId,
            note: `Interview scheduled for ${new Date(body.scheduledAt).toISOString()}`,
          },
        });
      }

      // Notify student
      const studentUserId = application.student.user.id;
      await tx.placementNotification.create({
        data: {
          userId: studentUserId,
          driveId: application.driveId,
          type: 'INTERVIEW_SCHEDULED',
          title: 'Interview Scheduled',
          message: `Your interview for ${application.drive.jobTitle} is scheduled on ${new Date(body.scheduledAt).toLocaleString()}.`,
          linkTarget: `/recruitment/interviews`,
          isRead: false,
          dedupeKey: `interview-scheduled-${iv.id}`,
        },
      });

      return iv;
    });

    return sendSuccess(res, interview, 'Interview scheduled.', 201);
  })
);

// PUT /interviews/:id — admin updates/reschedules interview
recruitmentRouter.put(
  '/interviews/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const body = updateInterviewSchema.parse(req.body);

    const interview = await prisma.interviewSchedule.findUnique({
      where: { id },
      include: {
        application: {
          include: { student: { include: { user: { select: { id: true } } } }, drive: { select: { jobTitle: true } } },
        },
      },
    });

    if (!interview) throw new AppError(404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    if (interview.status === 'CANCELLED') {
      throw new AppError(400, 'INTERVIEW_CANCELLED', 'Cannot update a cancelled interview.');
    }

    if (body.mode === 'ONLINE' && body.meetingLink === undefined && interview.mode !== 'ONLINE') {
      throw new AppError(400, 'MISSING_MEETING_LINK', 'Meeting link is required for ONLINE interviews.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const iv = await tx.interviewSchedule.update({
        where: { id },
        data: {
          ...(body.scheduledAt !== undefined ? { scheduledAt: new Date(body.scheduledAt) } : {}),
          ...(body.durationMins !== undefined ? { durationMins: body.durationMins } : {}),
          ...(body.mode !== undefined ? { mode: body.mode } : {}),
          ...(body.meetingLink !== undefined ? { meetingLink: body.meetingLink } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
          status: 'RESCHEDULED',
          acknowledgedAt: null,
        },
      });

      // Notify student of rescheduling
      const studentUserId = interview.application.student.user.id;
      await tx.placementNotification.create({
        data: {
          userId: studentUserId,
          driveId: interview.application.driveId,
          type: 'INTERVIEW_CHANGED',
          title: 'Interview Rescheduled',
          message: `Your interview for ${interview.application.drive.jobTitle} has been rescheduled.`,
          linkTarget: `/recruitment/interviews`,
          isRead: false,
          dedupeKey: `interview-rescheduled-${id}-${Date.now()}`,
        },
      });

      return iv;
    });

    return sendSuccess(res, updated, 'Interview updated.');
  })
);

// POST /interviews/:id/cancel — admin cancels interview
recruitmentRouter.post(
  '/interviews/:id/cancel',
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const actorId = req.auth!.userId;

    const interview = await prisma.interviewSchedule.findUnique({
      where: { id },
      include: {
        application: {
          include: { student: { include: { user: { select: { id: true } } } }, drive: { select: { jobTitle: true } } },
        },
      },
    });

    if (!interview) throw new AppError(404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    if (interview.status === 'CANCELLED') {
      throw new AppError(400, 'ALREADY_CANCELLED', 'Interview is already cancelled.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const iv = await tx.interviewSchedule.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Revert application status back to SHORTLISTED if it was INTERVIEW_SCHEDULED
      const app = interview.application;
      if (app.status === 'INTERVIEW_SCHEDULED') {
        // Check if there are other non-cancelled interviews
        const otherActiveInterviews = await tx.interviewSchedule.count({
          where: { applicationId: app.id, status: { not: 'CANCELLED' }, id: { not: id } },
        });

        if (otherActiveInterviews === 0) {
          await tx.jobApplication.update({
            where: { id: app.id },
            data: { status: 'SHORTLISTED' },
          });

          await tx.applicationStatusHistory.create({
            data: {
              applicationId: app.id,
              fromStatus: 'INTERVIEW_SCHEDULED',
              toStatus: 'SHORTLISTED',
              actorId,
              note: 'Interview cancelled; application reverted to SHORTLISTED.',
            },
          });
        }
      }

      // Notify student
      const studentUserId = interview.application.student.user.id;
      await tx.placementNotification.create({
        data: {
          userId: studentUserId,
          driveId: interview.application.driveId,
          type: 'INTERVIEW_CANCELLED',
          title: 'Interview Cancelled',
          message: `Your interview for ${interview.application.drive.jobTitle} has been cancelled.`,
          linkTarget: `/recruitment/interviews`,
          isRead: false,
          dedupeKey: `interview-cancelled-${id}`,
        },
      });

      return iv;
    });

    return sendSuccess(res, updated, 'Interview cancelled.');
  })
);

// GET /interviews/my — student lists own upcoming interviews
recruitmentRouter.get(
  '/interviews/my',
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;

    const interviews = await prisma.interviewSchedule.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RESCHEDULED', 'ACKNOWLEDGED'] },
        application: { studentId },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        application: {
          include: {
            drive: {
              include: {
                company: { select: { id: true, name: true, logoIcon: true } },
              },
            },
          },
        },
      },
    });

    return sendSuccess(res, interviews, 'Upcoming interviews retrieved');
  })
);

// POST /interviews/:id/acknowledge — student acknowledges interview
recruitmentRouter.post(
  '/interviews/:id/acknowledge',
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const studentId = req.auth!.studentId!;

    const interview = await prisma.interviewSchedule.findUnique({
      where: { id },
      include: { application: { select: { studentId: true } } },
    });

    if (!interview) throw new AppError(404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    if (interview.application.studentId !== studentId) {
      throw new AppError(403, 'FORBIDDEN', 'This interview does not belong to you.');
    }
    if (interview.status === 'CANCELLED') {
      throw new AppError(400, 'INTERVIEW_CANCELLED', 'Cannot acknowledge a cancelled interview.');
    }

    const updated = await prisma.interviewSchedule.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    });

    return sendSuccess(res, updated, 'Interview acknowledged.');
  })
);

// ============================================================================
// 5. NOTIFICATIONS
// ============================================================================

// GET /placement-notifications — list own notifications (paginated)
recruitmentRouter.get(
  '/placement-notifications',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 20, 100);
    const unreadOnly = req.query.unread === 'true';

    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [total, notifications] = await Promise.all([
      prisma.placementNotification.count({ where }),
      prisma.placementNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
      }),
    ]);

    return sendSuccess(
      res,
      notifications,
      'Notifications retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

// GET /placement-notifications/count — unread count
recruitmentRouter.get(
  '/placement-notifications/count',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const count = await prisma.placementNotification.count({
      where: { userId, isRead: false },
    });
    return sendSuccess(res, { unread: count });
  })
);

// POST /placement-notifications/read-all — mark all as read
recruitmentRouter.post(
  '/placement-notifications/read-all',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const { count } = await prisma.placementNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return sendSuccess(res, { marked: count }, 'All notifications marked as read.');
  })
);

// POST /placement-notifications/:id/read — mark one as read
recruitmentRouter.post(
  '/placement-notifications/:id/read',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const userId = req.auth!.userId;

    const notif = await prisma.placementNotification.findFirst({
      where: { id, userId },
    });
    if (!notif) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');

    const updated = await prisma.placementNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return sendSuccess(res, updated, 'Notification marked as read.');
  })
);

// GET /notification-preferences — get own preferences
recruitmentRouter.get(
  '/notification-preferences',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId },
    });
    return sendSuccess(res, prefs, 'Notification preferences retrieved');
  })
);

// PUT /notification-preferences — update own preferences
recruitmentRouter.put(
  '/notification-preferences',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const { preferences } = updateNotifPreferencesSchema.parse(req.body);

    // Upsert each preference
    const results = await Promise.all(
      preferences.map((pref) =>
        prisma.notificationPreference.upsert({
          where: { userId_notifType: { userId, notifType: pref.notifType } },
          create: { userId, notifType: pref.notifType, enabled: pref.enabled },
          update: { enabled: pref.enabled },
        })
      )
    );

    return sendSuccess(res, results, 'Notification preferences updated.');
  })
);
