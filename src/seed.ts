import bcrypt from "bcryptjs";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { Role } from "./generated/prisma/enums";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@fsm.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin123!";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "System Admin";
const BCRYPT_SALT_ROUNDS = Number(config.bcrypt_salt_rounds);

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existingAdmin) {
    console.log(
      `Admin already exists (email: ${existingAdmin.email}) — skipping seed.`,
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });

  console.log(`Admin seeded successfully: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
