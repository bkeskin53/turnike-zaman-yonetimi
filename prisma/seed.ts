import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function makePrisma() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

const ACTIVE_COMPANY_KEY = "ACTIVE_COMPANY_ID";

async function main() {
  const prisma = makePrisma();

  // 1) Ensure active company + policy
  const desiredName = process.env.SEED_COMPANY_NAME ?? "Default Company";

  const setting = await prisma.systemSetting.findUnique({
    where: { key: ACTIVE_COMPANY_KEY },
    select: { value: true },
  });

  let companyId: string | undefined = setting?.value ?? undefined;

  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) companyId = undefined;
  }

  if (!companyId) {
    const company = await prisma.company.create({
      data: {
        name: desiredName,
        policy: { create: {} },
      },
      select: { id: true },
    });

    companyId = company.id;

    await prisma.systemSetting.upsert({
      where: { key: ACTIVE_COMPANY_KEY },
      update: { value: companyId },
      create: { key: ACTIVE_COMPANY_KEY, value: companyId },
    });
  } else {
    // ensure policy exists for existing company
    await prisma.companyPolicy.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    });
  }

  // 2) Seed admin
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    select: { id: true, email: true, role: true, isActive: true },
  });

  console.log("Seeded admin:", user);
  console.log("Active company id:", companyId);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
