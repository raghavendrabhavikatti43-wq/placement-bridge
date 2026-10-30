import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../../src/server/app.ts';
import { prisma, disconnectPrisma } from '../../src/db/prisma.ts';
import { ensureSeededOnce } from '../../src/db/seed.ts';

const app = createApiApp();
const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

const runSuffix = crypto.randomBytes(4).toString('hex');
const studentAEmail = `test.student.a.${runSuffix}@nie.edu.in`;
const studentBEmail = `test.student.b.${runSuffix}@nie.edu.in`;
const strongPass = 'TestPass@2026!';

let studentAToken = '';
let studentARefresh = '';
let studentBToken = '';
let adminToken = '';
let studentAProjectId = '';

beforeAll(async () => {
  await ensureSeededOnce();
}, 60000);

afterAll(async () => {
  if (createdCompanyIds.length > 0) {
    await prisma.company.deleteMany({
      where: { id: { in: createdCompanyIds } },
    });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }
  await disconnectPrisma();
});

describe('Placement Bridge API v1 — Full-Stack Neon PostgreSQL + Prisma Integration Suite', { timeout: 120000 }, () => {
  it('SYS-01: GET /api/v1/health reports Neon PostgreSQL connected via Prisma ORM and capability flags', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database).toBe('connected');
    expect(res.body.data.orm).toBe('prisma');
    expect(res.body.data.executionEnabled).toBe(false);
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('AUTH-01 & AUTH-02: registers Student A & B without leaking passwordHash and rejects duplicate email with 409', async () => {
    const resA = await request(app).post('/api/v1/auth/register').send({
      email: studentAEmail,
      password: strongPass,
      fullName: '=FormulaTest Student A',
      department: 'Computer Engg (CSE)',
      graduationYear: 2027,
      cgpa: 8.6,
    });
    expect(resA.status).toBe(201);
    expect(resA.body.success).toBe(true);
    expect(JSON.stringify(resA.body)).not.toContain('passwordHash');
    studentAToken = resA.body.data.accessToken;
    studentARefresh = resA.body.data.refreshToken;
    createdUserIds.push(resA.body.data.user.id);

    const dup = await request(app).post('/api/v1/auth/register').send({
      email: studentAEmail,
      password: strongPass,
      fullName: 'Duplicate Student',
    });
    expect(dup.status).toBe(409);

    const resB = await request(app).post('/api/v1/auth/register').send({
      email: studentBEmail,
      password: strongPass,
      fullName: 'Student B',
      department: 'Information Tech (IT)',
      graduationYear: 2027,
      cgpa: 7.9,
    });
    expect(resB.status).toBe(201);
    studentBToken = resB.body.data.accessToken;
    createdUserIds.push(resB.body.data.user.id);
  });

  it('AUTH-05 & AUTH-06: rotates refresh token and revokes all active sessions when an already-rotated token is reused', async () => {
    const rot1 = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: studentARefresh });
    expect(rot1.status).toBe(200);
    const newerRefresh = rot1.body.data.refreshToken;
    expect(newerRefresh).toBeTruthy();
    expect(newerRefresh).not.toBe(studentARefresh);

    // Replay the OLD already-rotated refresh token -> triggers token reuse breach detection!
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: studentARefresh });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_TOKEN_REUSED');

    // Even the newer refresh token must now be revoked because all sessions were invalidated!
    const afterBreach = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: newerRefresh });
    expect(afterBreach.status).toBe(401);

    // Sign back in cleanly to obtain fresh session for subsequent tests
    const relogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: studentAEmail, password: strongPass });
    expect(relogin.status).toBe(200);
    studentAToken = relogin.body.data.accessToken;
    studentARefresh = relogin.body.data.refreshToken;
  });

  it('AUTH-04: locks student account with 423 after 5 consecutive wrong passwords', async () => {
    const lockEmail = `locktest.${runSuffix}@nie.edu.in`;
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: lockEmail,
      password: strongPass,
      fullName: 'Lockout Candidate',
    });
    expect(reg.status).toBe(201);
    createdUserIds.push(reg.body.data.user.id);

    for (let i = 0; i < 4; i++) {
      const bad = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: lockEmail, password: 'WrongPassword@999' });
      expect(bad.status).toBe(401);
    }

    const fifthBadAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: lockEmail, password: 'WrongPassword@999' });
    expect(fifthBadAttempt.status).toBe(423);

    const lockedAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: lockEmail, password: strongPass });
    expect(lockedAttempt.status).toBe(423);
    expect(lockedAttempt.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('AUTH-08: blocks STUDENT token from accessing /api/v1/admin/* with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(res.status).toBe(403);
  });

  it('PRO-01..04: validates CGPA/backlog invariants and prevents IDOR across Student A & Student B', async () => {
    const badCgpa = await request(app)
      .put('/api/v1/students/me')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ cgpa: 12 });
    expect(badCgpa.status).toBe(400);

    const badBacklogs = await request(app)
      .put('/api/v1/students/me')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ activeBacklogs: 3, totalBacklogs: 1 });
    expect(badBacklogs.status).toBe(400);

    const goodUpdate = await request(app)
      .put('/api/v1/students/me')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        tenthPct: 91.2,
        twelfthPct: 89.5,
        cgpa: 8.75,
        activeBacklogs: 0,
        totalBacklogs: 0,
        skillsList: ['Java', 'SQL', 'Data Structures & Algorithms', 'React'],
      });
    expect(goodUpdate.status).toBe(200);
    expect(goodUpdate.body.data.completion.completionPct).toBeGreaterThanOrEqual(45);

    const projCreate = await request(app)
      .post('/api/v1/students/me/projects')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        title: 'Neon PostgreSQL Placement Portal',
        description: 'Engineered full-stack placement system with Prisma ORM and Neon PostgreSQL.',
        technologies: ['TypeScript', 'PostgreSQL', 'Prisma', 'React'],
        githubUrl: 'https://github.com/example/placement-portal',
      });
    expect(projCreate.status).toBe(201);
    studentAProjectId = projCreate.body.data.id;

    // PRO-03 IDOR check: Student B attempts to modify/delete Student A's project -> 404
    const idorUpdate = await request(app)
      .put(`/api/v1/students/me/projects/${studentAProjectId}`)
      .set('Authorization', `Bearer ${studentBToken}`)
      .send({ title: 'Hijacked Title', technologies: [] });
    expect(idorUpdate.status).toBe(404);

    const idorDelete = await request(app)
      .delete(`/api/v1/students/me/projects/${studentAProjectId}`)
      .set('Authorization', `Bearer ${studentBToken}`);
    expect(idorDelete.status).toBe(404);
  });

  it('CMP / ELG / REC / GAP: returns SAMPLE dataStatus and persists eligibility, recommendations, and skill gap reports', async () => {
    const comps = await request(app)
      .get('/api/v1/companies')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(comps.status).toBe(200);
    expect(comps.body.data.length).toBeGreaterThanOrEqual(10);
    expect(comps.body.data.some((c: { dataStatus: string }) => c.dataStatus === 'SAMPLE')).toBe(
      true
    );

    const elig = await request(app)
      .post('/api/v1/eligibility/check')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({});
    expect(elig.status).toBe(200);
    expect(elig.body.data.summary.totalEvaluated).toBeGreaterThanOrEqual(10);

    const recs = await request(app)
      .post('/api/v1/recommendations/run')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({});
    expect(recs.status).toBe(200);
    expect(recs.body.data.recommendations.length).toBeGreaterThan(0);
    expect(recs.body.data.recommendations[0].rank).toBe(1);

    const gap = await request(app)
      .post('/api/v1/skill-gap')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({});
    expect(gap.status).toBe(200);
    expect(typeof gap.body.data.coveragePct).toBe('number');
  });

  it('APT-01..04: hides answers during active attempt, ignores forged client score on submit, and blocks double submit with 409', async () => {
    const startRes = await request(app)
      .post('/api/v1/aptitude/attempts')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ category: 'QUANTITATIVE', numQuestions: 5, timeLimitSec: 300 });
    expect(startRes.status).toBe(201);

    const attemptId = startRes.body.data.attempt.id;
    const questions = startRes.body.data.questions;
    expect(questions.length).toBe(5);
    expect(JSON.stringify(questions)).not.toContain('isCorrect');
    expect(JSON.stringify(questions)).not.toContain('explanation');

    // Polling GET while IN_PROGRESS also hides isCorrect & explanation
    const inProgGet = await request(app)
      .get(`/api/v1/aptitude/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(inProgGet.status).toBe(200);
    expect(JSON.stringify(inProgGet.body.data.questions)).not.toContain('isCorrect');

    // Submit with a forged `score: 999` — server must ignore forged score and compute real 0..5 score
    const submitRes = await request(app)
      .post(`/api/v1/aptitude/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        score: 999,
        answers: questions.map((q: { id: string; options: { id: string }[] }) => ({
          questionId: q.id,
          optionId: q.options[0].id,
        })),
      });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.score).toBeLessThanOrEqual(5);
    expect(submitRes.body.data.results[0].explanation).toBeTruthy();

    // Second submit returns 409 ALREADY_SUBMITTED
    const doubleSubmit = await request(app)
      .post(`/api/v1/aptitude/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ answers: [] });
    expect(doubleSubmit.status).toBe(409);
  });

  it('COD-01..03: never exposes hidden test cases and records PRACTICE mode submission with executed=false', async () => {
    const listRes = await request(app)
      .get('/api/v1/coding/problems')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.executionEnabled).toBe(false);
    expect(listRes.body.data.mode).toBe('PRACTICE');

    const firstSlug = listRes.body.data.problems[0].slug;
    const detailRes = await request(app)
      .get(`/api/v1/coding/problems/${firstSlug}`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.sampleTestCases.length).toBeGreaterThan(0);
    expect(JSON.stringify(detailRes.body.data.sampleTestCases)).not.toContain('isHidden');

    const subRes = await request(app)
      .post(`/api/v1/coding/problems/${firstSlug}/submissions`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        languageKey: 'java',
        sourceCode: 'class Solution { public int solve(int[] nums) { return nums.length; } }',
        selfMarkSolved: true,
      });
    expect(subRes.status).toBe(201);
    expect(subRes.body.data.executed).toBe(false);
    expect(subRes.body.data.submission.status).toBe('SELF_MARKED_SOLVED');
  });

  it('INT / RES / RDY: evaluates interview session rubric, generates real PDF resume, blocks spoofed file uploads, and returns readiness disclaimer', async () => {
    // 1. Interview session + deterministic rubric feedback
    const sessRes = await request(app)
      .post('/api/v1/interview/sessions')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ type: 'TECHNICAL', count: 2 });
    expect(sessRes.status).toBe(201);
    const sessId = sessRes.body.data.session.id;
    const qId = sessRes.body.data.questions[0].id;

    const ansRes = await request(app)
      .put(`/api/v1/interview/sessions/${sessId}/answers/${qId}`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        answerText:
          'First, I would clarify functional constraints and latency SLOs. Next, I would choose an indexed relational schema with B-tree indexes for O(log N) lookups and Redis caching for hot reads, handling cache invalidation trade-offs carefully.',
      });
    expect(ansRes.status).toBe(200);

    const fbRes = await request(app)
      .post(`/api/v1/interview/answers/${ansRes.body.data.id}/feedback`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ useAi: false });
    expect(fbRes.status).toBe(200);
    expect(fbRes.body.data.source).toBe('RUBRIC');

    // 2. Resume create + server-side PDF generation + signed download verification
    const resumeCreate = await request(app)
      .post('/api/v1/resume')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        title: 'Campus SDE-1 Resume',
        template: 'modern',
        setPrimary: true,
        content: {
          summary: 'Final-year CSE undergraduate focused on distributed backend systems.',
        },
      });
    expect(resumeCreate.status).toBe(201);

    const pdfGen = await request(app)
      .post(`/api/v1/resume/${resumeCreate.body.data.id}/pdf`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(pdfGen.status).toBe(201);
    expect(pdfGen.body.data.signedUrl).toContain('/api/v1/files/');

    const dlPath = new URL(pdfGen.body.data.signedUrl, 'http://localhost:3000');
    const pdfDownload = await request(app).get(`${dlPath.pathname}${dlPath.search}`);
    expect(pdfDownload.status).toBe(200);
    expect(pdfDownload.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(pdfDownload.body).subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // 3. RES-02: Spoofed magic-byte file upload (.exe MZ header disguised as resume.pdf) -> 400
    const spoofedExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const spoofUpload = await request(app)
      .post('/api/v1/files/resume')
      .set('Authorization', `Bearer ${studentAToken}`)
      .attach('file', spoofedExe, { filename: 'resume.pdf', contentType: 'application/pdf' });
    expect(spoofUpload.status).toBe(400);

    // 4. Readiness & Dashboard aggregator
    const rdy = await request(app)
      .get('/api/v1/readiness')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(rdy.status).toBe(200);
    expect(rdy.body.data.disclaimer).toContain('not a prediction or guarantee of placement');

    const dash = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(dash.status).toBe(200);
    expect(dash.body.data.readiness).toBeTruthy();
  });

  it('ADM-01..04: authenticates TPO Admin custodian, returns SQL-aggregated analytics, and escapes CSV formula cells', async () => {
    // Ensure admin is not locked from any prior state
    await prisma.user.updateMany({
      where: { role: 'ADMIN' },
      data: { failedLogins: 0, lockedUntil: null },
    });

    const chRes = await request(app).get('/api/v1/auth/challenge');
    expect(chRes.status).toBe(200);
    const { challengeId, code } = chRes.body.data;

    const admLogin = await request(app).post('/api/v1/auth/admin/login').send({
      userId: 'TPO-ADMIN-01',
      email: 'admin.tpo@nie-placement.edu',
      password: 'NieTpo@2026#Secure!',
      challengeId,
      challengeAnswer: code,
    });
    expect(admLogin.status).toBe(200);
    adminToken = admLogin.body.data.accessToken;
    expect(adminToken).toBeTruthy();

    const deptAnalytics = await request(app)
      .get('/api/v1/admin/analytics/departments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deptAnalytics.status).toBe(200);
    expect(Array.isArray(deptAnalytics.body.data)).toBe(true);
    expect(deptAnalytics.body.data.length).toBeGreaterThan(0);

    const csvRes = await request(app)
      .get('/api/v1/admin/reports/students.csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    // Student A's name started with `=FormulaTest Student A`, which MUST be prefixed with a single quote `'`
    expect(csvRes.text).toContain("'=FormulaTest Student A");
  });

  it('CRUD-01: verifies persistent Create, Retrieve, Update, and Delete (CRUD) in Neon PostgreSQL across Student Portfolio, Preparation Progress, and Admin Companies', async () => {
    // 1. UPDATE & RETRIEVE Student A's existing project, then DELETE it and verify 404/absence
    const updProj = await request(app)
      .put(`/api/v1/students/me/projects/${studentAProjectId}`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        title: 'Neon PostgreSQL Placement Portal v2',
        description: 'Updated description persisted in Neon via Prisma ORM.',
        technologies: ['TypeScript', 'PostgreSQL', 'Prisma'],
      });
    expect(updProj.status).toBe(200);
    expect(updProj.body.data.title).toBe('Neon PostgreSQL Placement Portal v2');

    const getMeAfterUpdate = await request(app)
      .get('/api/v1/students/me')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(getMeAfterUpdate.status).toBe(200);
    expect(
      getMeAfterUpdate.body.data.projects.some(
        (p: { id: string; title: string }) =>
          p.id === studentAProjectId && p.title === 'Neon PostgreSQL Placement Portal v2'
      )
    ).toBe(true);

    const delProj = await request(app)
      .delete(`/api/v1/students/me/projects/${studentAProjectId}`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(delProj.status).toBe(200);
    expect(delProj.body.data.deleted).toBe(true);

    const dbProjAfterDel = await prisma.project.findUnique({ where: { id: studentAProjectId } });
    expect(dbProjAfterDel).toBeNull();

    // 2. Preparation Topic Progress CREATE/UPSERT + RETRIEVE
    const topicsRes = await request(app)
      .get('/api/v1/preparation/topics')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(topicsRes.status).toBe(200);
    const firstTopicId = topicsRes.body.data[0].id;

    const progUpd = await request(app)
      .put(`/api/v1/preparation/topics/${firstTopicId}/progress`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ status: 'COMPLETED' });
    expect(progUpd.status).toBe(200);
    expect(progUpd.body.data.progress.status).toBe('COMPLETED');

    const overviewRes = await request(app)
      .get('/api/v1/progress/overview')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.topicsCompleted).toBeGreaterThanOrEqual(1);

    // 3. Admin Company CREATE -> RETRIEVE -> UPDATE -> DELETE (soft-archive) + clean up
    const createComp = await request(app)
      .post('/api/v1/admin/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Neon CRUD Test Corp ${runSuffix}`,
        industry: 'Cloud Infrastructure',
        packageInfo: '18.5 LPA',
        roleTitle: 'Backend Systems Engineer',
        minCgpa: 7.5,
        allowedBranches: ['CSE', 'IT'],
        dataStatus: 'VERIFIED',
      });
    expect(createComp.status).toBe(201);
    const compId = createComp.body.data.id;
    createdCompanyIds.push(compId);

    const updateComp = await request(app)
      .put(`/api/v1/admin/companies/${compId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ packageInfo: '21.0 LPA', location: 'Hyderabad / Hybrid' });
    expect(updateComp.status).toBe(200);
    expect(updateComp.body.data.packageInfo).toBe('21.0 LPA');

    const archiveComp = await request(app)
      .delete(`/api/v1/admin/companies/${compId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(archiveComp.status).toBe(200);
    expect(archiveComp.body.data.archived).toBe(true);

    const archivedInDb = await prisma.company.findUnique({ where: { id: compId } });
    expect(archivedInDb?.isActive).toBe(false);
  });
});
