import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma, Prisma } from '../../db/prisma.ts';
import { recalculateAndPersistProfileCompletion } from '../../db/users.ts';
import { getCapabilityFlags } from '../config/env.ts';
import { redactPiiFromText } from '../engines/redaction.ts';
import {
  analyzeResumeDeterministically,
  extractResumeText,
  generateResumePdfBuffer,
} from '../engines/resumeAnalyzer.ts';
import {
  generateAiMockQuestionOrCodeReview,
  generateAiResumeSuggestions,
  generateGroundedPlacementChat,
} from '../integrations/gemini.ts';
import {
  createSignedFileUrl,
  readStoredFileBuffer,
  validateAndStoreFile,
} from '../integrations/storage.ts';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { aiRateLimiter, uploadRateLimiter, validateBody } from '../middleware/security.ts';
import {
  buildGroundedAiFactsForStudent,
  loadAllSkillsCatalogue,
  loadStudentFullContext,
} from '../services/studentDataService.ts';
import { AppError, asyncHandler, sanitizeDbError } from '../utils/errors.ts';
import { sendSuccess } from '../utils/response.ts';

export const resumeAiRouter = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const createResumeSchema = z.object({
  title: z.string().trim().min(2).max(160),
  template: z.enum(['classic', 'modern', 'minimal']).default('classic'),
  content: z.record(z.string(), z.unknown()).default({}),
  setPrimary: z.boolean().default(false),
});

const aiChatBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});

// ============================================================================
// RESUME BUILDER, PDF GENERATOR & DETERMINISTIC ANALYZER (Part F11 & Part I)
// ============================================================================
resumeAiRouter.get(
  '/resume/data',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const ctx = await loadStudentFullContext(req.auth!.studentId!);
    if (!ctx) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');

    return sendSuccess(res, {
      personal: {
        fullName: ctx.profile.fullName,
        email: ctx.user?.email || req.auth!.email,
        phone: ctx.profile.phone,
        college: ctx.profile.college,
        degree: ctx.profile.degree,
        department: ctx.profile.department,
        graduationYear: ctx.profile.graduationYear,
        cgpa: ctx.profile.cgpa,
        summary: ctx.profile.resumeSummary || ctx.profile.bio,
      },
      skills: ctx.skills.map((s) => ({
        name: s.name,
        category: s.category,
        proficiency: s.proficiency,
      })),
      projects: ctx.projects,
      internships: ctx.internships,
      certifications: ctx.certifications,
      achievements: ctx.achievements,
    });
  })
);

resumeAiRouter.post(
  '/resume',
  authenticate,
  requireRole('STUDENT'),
  validateBody(createResumeSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const existing = await prisma.resume.findMany({
      where: { studentId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (existing[0]?.version || 0) + 1;
    const isPrimary = req.body.setPrimary || existing.length === 0;

    if (isPrimary && existing.length > 0) {
      await prisma.resume.updateMany({
        where: { studentId },
        data: { isPrimary: false },
      });
    }

    const created = await prisma.resume.create({
      data: {
        studentId,
        title: req.body.title,
        template: req.body.template,
        version: nextVersion,
        content: (req.body.content || {}) as Prisma.InputJsonValue,
        isPrimary,
      },
    });

    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);
    return sendSuccess(res, created, 'Resume version saved', 201);
  })
);

resumeAiRouter.get(
  '/resume',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.resume.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: [{ isPrimary: 'desc' }, { version: 'desc' }],
    });
    return sendSuccess(res, rows);
  })
);

resumeAiRouter.get(
  '/resume/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume version not found.');
    }
    const row = await prisma.resume.findFirst({
      where: { id, studentId: req.auth!.studentId! },
    });
    if (!row) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume version not found.');
    return sendSuccess(res, row);
  })
);

resumeAiRouter.put(
  '/resume/:id/primary',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume version not found.');
    }

    const target = await prisma.resume.findFirst({
      where: { id, studentId },
    });
    if (!target) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume version not found.');

    await prisma.resume.updateMany({
      where: { studentId },
      data: { isPrimary: false },
    });
    const updated = await prisma.resume.update({
      where: { id },
      data: { isPrimary: true },
    });

    return sendSuccess(res, updated, 'Primary resume updated');
  })
);

resumeAiRouter.post(
  '/resume/:id/pdf',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume version not found.');
    }

    const resumeRow = await prisma.resume.findFirst({
      where: { id, studentId },
    });
    if (!resumeRow) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume version not found.');

    const ctx = await loadStudentFullContext(studentId);
    if (!ctx) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');

    const contentObj = (resumeRow.content || {}) as Record<string, unknown>;
    const pdfBuffer = await generateResumePdfBuffer({
      template: resumeRow.template,
      fullName: String(contentObj.fullName || ctx.profile.fullName),
      email: String(contentObj.email || ctx.user?.email || req.auth!.email),
      phone: contentObj.phone ? String(contentObj.phone) : ctx.profile.phone,
      college: ctx.profile.college,
      degree: ctx.profile.degree,
      department: ctx.profile.department,
      graduationYear: ctx.profile.graduationYear,
      cgpa: ctx.profile.cgpa,
      summary: contentObj.summary
        ? String(contentObj.summary)
        : ctx.profile.resumeSummary || ctx.profile.bio,
      skills: Array.isArray(contentObj.skills)
        ? contentObj.skills.map(String)
        : ctx.skills.map((s) => s.name),
      projects: ctx.projects,
      internships: ctx.internships,
      certifications: ctx.certifications,
      achievements: ctx.achievements,
    });

    const asset = await validateAndStoreFile({
      ownerId: req.auth!.userId,
      kind: 'GENERATED_RESUME',
      originalName: `${resumeRow.title.replace(/[^\w\-]+/g, '_')}_v${resumeRow.version}.pdf`,
      buffer: pdfBuffer,
      declaredMime: 'application/pdf',
    });

    await prisma.resume.update({
      where: { id: resumeRow.id },
      data: { fileId: asset.id },
    });

    const signed = createSignedFileUrl(asset.id, 600);
    return sendSuccess(
      res,
      { resumeId: resumeRow.id, fileId: asset.id, ...signed },
      'PDF generated',
      201
    );
  })
);

resumeAiRouter.post(
  '/resume/analyze',
  authenticate,
  requireRole('STUDENT'),
  uploadRateLimiter,
  resumeUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const jobDescription =
      typeof req.body?.jobDescription === 'string'
        ? req.body.jobDescription.trim().slice(0, 6000)
        : null;
    const useAi = req.body?.useAi === true || req.body?.useAi === 'true';

    let fileId: string | null = null;
    let rawText = '';

    if (req.file) {
      const asset = await validateAndStoreFile({
        ownerId: req.auth!.userId,
        kind: 'RESUME',
        originalName: req.file.originalname,
        buffer: req.file.buffer,
        declaredMime: req.file.mimetype,
      });
      fileId = asset.id;
      rawText = await extractResumeText(req.file.buffer, asset.mimeType);
    } else if (typeof req.body?.fileId === 'string' && req.body.fileId.trim()) {
      const stored = await readStoredFileBuffer(req.body.fileId.trim());
      if (stored.asset.ownerId !== req.auth!.userId && req.auth!.role !== 'ADMIN') {
        throw new AppError(403, 'FORBIDDEN', 'Cannot analyze another user resume file.');
      }
      fileId = stored.asset.id;
      rawText = await extractResumeText(stored.buffer, stored.asset.mimeType);
    } else if (typeof req.body?.resumeText === 'string' && req.body.resumeText.trim()) {
      rawText = req.body.resumeText.trim();
    } else {
      throw new AppError(
        400,
        'RESUME_INPUT_REQUIRED',
        'Upload a PDF/DOCX resume file, provide a fileId, or supply resumeText.'
      );
    }

    const catalogueSkills = await loadAllSkillsCatalogue();
    const deterministic = analyzeResumeDeterministically(
      rawText,
      catalogueSkills,
      jobDescription
    );

    let aiUsed = false;
    let mergedSuggestions = [...deterministic.suggestions];
    const { aiEnabled } = getCapabilityFlags();

    if (useAi && aiEnabled && rawText.length >= 20) {
      try {
        const redacted = redactPiiFromText(rawText, [req.auth!.fullName]);
        const aiSuggestions = await generateAiResumeSuggestions({
          redactedResumeText: redacted,
          jobDescription,
        });
        if (aiSuggestions.length > 0) {
          mergedSuggestions = [...deterministic.suggestions, ...aiSuggestions];
          aiUsed = true;
        }
      } catch {
        // Automatic deterministic fallback per Part I
        aiUsed = false;
      }
    }

    const saved = await prisma.resumeAnalysis.create({
      data: {
        studentId,
        fileId,
        jobDescription,
        extracted: {
          ...deterministic.extracted,
          matchedKeywords: deterministic.matchedKeywords,
          missingKeywords: deterministic.missingKeywords,
        } as unknown as Prisma.InputJsonValue,
        keywordMatchPct: deterministic.keywordMatchPct,
        suggestions: mergedSuggestions as unknown as Prisma.InputJsonValue,
        aiUsed,
      },
    });

    await prisma.learningActivityLog.create({
      data: {
        studentId,
        type: 'RESUME_ANALYZED',
        refId: saved.id,
        metadata: {
          keywordMatchPct: deterministic.keywordMatchPct,
          aiUsed,
        } as Prisma.InputJsonValue,
      },
    });

    await recalculateAndPersistProfileCompletion(studentId, req.auth!.userId);

    return sendSuccess(res, {
      analysisId: saved.id,
      fileId,
      extracted: deterministic.extracted,
      keywordMatchPct: deterministic.keywordMatchPct,
      scoreDisclaimer:
        'Deterministic keyword match score against the provided job description; not a guarantee of ATS or recruiter selection.',
      matchedKeywords: deterministic.matchedKeywords,
      missingKeywords: deterministic.missingKeywords,
      suggestions: mergedSuggestions,
      aiUsed,
      createdAt: saved.createdAt,
    });
  })
);

resumeAiRouter.get(
  '/resume/analyses',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.resumeAnalysis.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return sendSuccess(res, rows);
  })
);

// ============================================================================
// GROUNDED AI CAREER ASSISTANT (Part F12 & Part I)
// ============================================================================
resumeAiRouter.get('/ai/status', optionalAuthenticate, (_req, res) => {
  const { aiEnabled } = getCapabilityFlags();
  return sendSuccess(res, { aiEnabled });
});

resumeAiRouter.post(
  '/ai/chat',
  authenticate,
  requireRole('STUDENT'),
  aiRateLimiter,
  validateBody(aiChatBodySchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { aiEnabled } = getCapabilityFlags();
    if (!aiEnabled) {
      throw new AppError(
        503,
        'AI_NOT_CONFIGURED',
        'AI assistant is not configured. Deterministic eligibility, skill-gap, and practice modules remain active.'
      );
    }

    const studentId = req.auth!.studentId!;
    const { message, conversationId } = req.body;

    try {
      let convId = conversationId;
      if (convId) {
        const existingConv = await prisma.aiConversation.findFirst({
          where: { id: convId, studentId },
        });
        if (!existingConv) {
          throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'AI conversation not found.');
        }
      } else {
        const newConv = await prisma.aiConversation.create({
          data: {
            studentId,
            title: message.slice(0, 72),
          },
        });
        convId = newConv.id;
      }

      const prevMsgs = await prisma.aiMessage.findMany({
        where: { conversationId: convId },
        orderBy: { createdAt: 'asc' },
      });

      const history = prevMsgs
        .filter((m): m is typeof m & { role: 'USER' | 'ASSISTANT' } =>
          m.role === 'USER' || m.role === 'ASSISTANT'
        )
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      // Build grounded FACTS strictly from authenticated student's PostgreSQL rows!
      const facts = await buildGroundedAiFactsForStudent(studentId);

      const aiResult = await generateGroundedPlacementChat({
        factsBlock: facts.factsBlock,
        usedFactLabels: facts.usedFactLabels,
        history,
        userMessage: message,
        studentNameToRedact: facts.studentFullName,
      });

      await prisma.aiMessage.createMany({
        data: [
          {
            conversationId: convId,
            role: 'USER',
            content: message,
          },
          {
            conversationId: convId,
            role: 'ASSISTANT',
            content: aiResult.reply,
            metadata: {
              usedFacts: aiResult.usedFacts,
              priorities: aiResult.priorities ?? [],
              recommendedTime: aiResult.recommendedTime ?? null,
              aiGenerated: true,
            } as Prisma.InputJsonValue,
          },
        ],
      });

      return sendSuccess(res, {
        conversationId: convId,
        reply: aiResult.reply,
        text: aiResult.reply,
        usedFacts: aiResult.usedFacts,
        priorities: aiResult.priorities,
        recommendedTime: aiResult.recommendedTime,
        aiGenerated: true,
      });
    } catch (err) {
      sanitizeDbError('ai.chat', err);
    }
  })
);

resumeAiRouter.get(
  '/ai/conversations',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.aiConversation.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, rows);
  })
);

resumeAiRouter.get(
  '/ai/conversations/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }
    const conv = await prisma.aiConversation.findFirst({
      where: { id, studentId: req.auth!.studentId! },
    });
    if (!conv) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');

    const messages = await prisma.aiMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    return sendSuccess(res, { conversation: conv, messages });
  })
);

resumeAiRouter.delete(
  '/ai/conversations/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }
    const deleted = await prisma.aiConversation.deleteMany({
      where: {
        id,
        studentId: req.auth!.studentId!,
      },
    });
    if (deleted.count === 0) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }
    return sendSuccess(res, { deleted: true }, 'Conversation deleted');
  })
);

resumeAiRouter.post(
  '/ai/code-review',
  authenticate,
  requireRole('STUDENT'),
  aiRateLimiter,
  asyncHandler(async (req, res) => {
    const review = await generateAiMockQuestionOrCodeReview({
      mode: 'code-review',
      payload: req.body || {},
    });
    return sendSuccess(res, review);
  })
);

resumeAiRouter.post(
  '/ai/mock-interview',
  authenticate,
  requireRole('STUDENT'),
  aiRateLimiter,
  asyncHandler(async (req, res) => {
    const out = await generateAiMockQuestionOrCodeReview({
      mode: 'mock-question',
      payload: req.body || {},
    });
    return sendSuccess(res, out);
  })
);
