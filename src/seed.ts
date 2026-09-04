import bcrypt from "bcryptjs";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { Role } from "./generated/prisma/enums";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@fsm.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin123!";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "System Admin";
const BCRYPT_SALT_ROUNDS = Number(config.bcrypt_salt_rounds);

const STARTER_CATEGORIES = [
  {
    name: "Plumbing",
    description:
      "Pipe repairs, leak fixes, fixture installation, and drainage issues.",
  },
  {
    name: "Electrical",
    description:
      "Wiring, circuit breakers, outlet and switch repairs, fixture installation.",
  },
  {
    name: "HVAC",
    description:
      "Air conditioning and heating installation, servicing, and repair.",
  },
  {
    name: "Appliance Repair",
    description:
      "Repair and maintenance of household appliances such as refrigerators and washing machines.",
  },
];

async function seedAdmin() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existingAdmin) {
    console.log(
      `Admin already exists (email: ${existingAdmin.email}) — skipping admin seed.`,
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

async function seedServiceCategories() {
  for (const category of STARTER_CATEGORIES) {
    const existing = await prisma.serviceCategory.findUnique({
      where: { name: category.name },
    });

    if (existing) {
      console.log(`Category "${category.name}" already exists — skipping.`);
      continue;
    }

    const created = await prisma.serviceCategory.create({
      data: category,
    });

    console.log(`Category seeded: ${created.name} (${created.id})`);
  }
}

async function main() {
  await seedAdmin();
  await seedServiceCategories();
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
 