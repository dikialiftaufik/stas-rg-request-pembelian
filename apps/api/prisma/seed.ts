import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

try {
  process.loadEnvFile();
} catch {
  // Abaikan jika berkas .env tidak ditemukan; variabel environment sistem tetap digunakan.
}

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 12;

async function main(): Promise<void> {
  const email = (process.env.ADMIN_SEED_EMAIL ?? 'admin@gmail.com').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'admin123';
  const name = (process.env.ADMIN_SEED_NAME ?? 'Administrator').trim();
  const identifier = (process.env.ADMIN_SEED_IDENTIFIER ?? 'admin').trim();

  if (!email || !password) {
    throw new Error('ADMIN_SEED_EMAIL dan ADMIN_SEED_PASSWORD tidak boleh kosong.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      identifier,
      passwordHash,
      role: Role.admin,
      isActive: true,
    },
    create: {
      name,
      identifier,
      email,
      passwordHash,
      role: Role.admin,
      isActive: true,
    },
  });

  process.stdout.write(
    `Seed Admin berhasil: ${admin.email} (id: ${admin.id}, role: ${admin.role})\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Gagal menjalankan seed database:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
