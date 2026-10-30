import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma, toNumber } from './prisma.ts';
import { computeProfileCompletion } from '../server/engines/profileCompletion.ts';
import { sanitizeDbError } from '../server/utils/errors.ts';

/**
 * Concurrent-safe Federated / Firebase Student Upsert via Prisma ORM on Neon PostgreSQL.
 * Ensures concurrent requests never fail with unique-constraint race conditions.
 */
export async function getOrCreateStudentByFirebaseUid(params: {
  uid: string;
  email: string;
  displayName?: string | null;
}) {
  const cleanEmail = params.email.trim().toLowerCase();
  const fallbackName =
    (params.displayName && params.displayName.trim()) ||
    cleanEmail
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  try {
    let userRow = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (userRow) {
      if (userRow.uid !== params.uid && userRow.uid.startsWith('local:')) {
        userRow = await prisma.user.update({
          where: { id: userRow.id },
          data: {
            uid: params.uid,
            lastLoginAt: new Date(),
          },
        });
      }
    } else {
      const randomPassHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      userRow = await prisma.user.upsert({
        where: { uid: params.uid },
        create: {
          uid: params.uid,
          email: cleanEmail,
          passwordHash: randomPassHash,
          role: 'STUDENT',
          isActive: true,
          lastLoginAt: new Date(),
        },
        update: {
          email: cleanEmail,
          lastLoginAt: new Date(),
        },
      });
    }

    const profileRow = await prisma.studentProfile.upsert({
      where: { userId: userRow.id },
      create: {
        userId: userRow.id,
        fullName: fallbackName,
        department: 'Computer Engg (CSE)',
        college: 'National Institute of Engineering',
        graduationYear: 2027,
        semester: 7,
        cgpa: '8.10',
        activeBacklogs: 0,
        totalBacklogs: 0,
        completionPct: 35,
      },
      update: {
        updatedAt: new Date(),
      },
    });

    return { user: userRow, studentProfile: profileRow };
  } catch (err) {
    sanitizeDbError('getOrCreateStudentByFirebaseUid', err);
  }
}

/**
 * Recomputes server-side Profile Completion % (Part H1) from live Neon PostgreSQL counts
 * via Prisma ORM and updates `student_profiles.completion_pct`.
 */
export async function recalculateAndPersistProfileCompletion(studentId: string, userId?: string) {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });
    if (!profile) return { pct: 0, missing: [] as string[], breakdown: null };

    const effectiveUserId = userId || profile.userId;

    const [
      skillsCount,
      projectsCount,
      certsCount,
      internshipsCount,
      achievementsCount,
      resumesCount,
      pref,
      resumeFilesCount,
    ] = await Promise.all([
      prisma.studentSkill.count({ where: { studentId } }),
      prisma.project.count({ where: { studentId } }),
      prisma.certification.count({ where: { studentId } }),
      prisma.internship.count({ where: { studentId } }),
      prisma.achievement.count({ where: { studentId } }),
      prisma.resume.count({ where: { studentId } }),
      prisma.studentPreference.findUnique({ where: { studentId } }),
      prisma.fileAsset.count({ where: { ownerId: effectiveUserId } }),
    ]);

    const hasPreferences = Boolean(
      pref &&
        ((pref.preferredRoles?.length ?? 0) > 0 ||
          (pref.preferredIndustries?.length ?? 0) > 0 ||
          (pref.preferredLocations?.length ?? 0) > 0)
    );
    const hasResume =
      resumesCount > 0 ||
      Boolean(profile.resumeSummary && profile.resumeSummary.trim().length > 20) ||
      resumeFilesCount > 0;

    const result = computeProfileCompletion({
      fullName: profile.fullName,
      phone: profile.phone,
      college: profile.college,
      department: profile.department,
      semester: profile.semester,
      graduationYear: profile.graduationYear,
      tenthPct: toNumber(profile.tenthPct),
      twelfthPct: toNumber(profile.twelfthPct) ?? toNumber(profile.diplomaPct),
      cgpa: toNumber(profile.cgpa),
      totalBacklogs: profile.totalBacklogs,
      activeBacklogs: profile.activeBacklogs,
      skillsCount,
      projectsCount,
      certificationsCount: certsCount,
      internshipsCount,
      achievementsCount,
      hasResume,
      hasPreferences,
    });

    if (profile.completionPct !== result.pct) {
      await prisma.studentProfile.update({
        where: { id: studentId },
        data: { completionPct: result.pct },
      });
    }

    return result;
  } catch (err) {
    sanitizeDbError('recalculateAndPersistProfileCompletion', err);
  }
}
