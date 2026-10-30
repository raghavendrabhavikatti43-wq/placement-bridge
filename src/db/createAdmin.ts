import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma, disconnectPrisma } from './prisma.ts';

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = (process.env.SEED_ADMIN_PASSWORD || '').trim();
  const custodianCode = (process.env.ADMIN_CUSTODIAN_CODE || 'TPO-ADMIN-01').trim();
  const adminName = (process.env.ADMIN_DISPLAY_NAME || 'Dr. Rajesh Verma').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set a valid SEED_ADMIN_EMAIL environment variable before running create-admin.');
  }
  if (password.length < 12 || password === 'change_me_before_seeding') {
    throw new Error(
      'Set a strong SEED_ADMIN_PASSWORD (minimum 12 characters) before running create-admin.'
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      uid: `local:${custodianCode.toLowerCase()}`,
      custodianCode,
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: true,
      adminMeta: {
        userId: custodianCode,
        email,
        name: adminName,
        title: 'Chief Training & Placement Officer',
        department: 'Department of Computer Science & Placement Cell',
        institutionName: 'National Institute of Engineering',
        batchYear: 2027,
        phone: '+91 821 248 0475',
        officeLocation: 'Administrative Block, Wing B — Room 204',
        officeHours: 'Mon – Fri · 10:00 AM to 4:30 PM IST',
        deskEmail: 'tpo.office@nie-placement.edu',
        bio: 'Authorized Placement Cell Administrator.',
        avatarUrl: '',
        avatarBg: 'indigo',
      },
    },
    update: {
      custodianCode,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: true,
    },
    select: {
      id: true,
      email: true,
      custodianCode: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'ADMIN_BOOTSTRAP_UPSERT',
      entity: 'USER',
      entityId: admin.id,
      metadata: { email: admin.email, custodianCode: admin.custodianCode },
      ip: 'cli',
    },
  });

  console.log('Admin account provisioned:', admin);
  await disconnectPrisma();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('create-admin failed:', err instanceof Error ? err.message : err);
  await disconnectPrisma();
  process.exit(1);
});
