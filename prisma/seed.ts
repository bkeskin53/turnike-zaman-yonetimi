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

  // 1.1) Ensure DEFAULT policy rule set exists (Phase-1: grouping ready, behavior unchanged)
  const basePolicy = await prisma.companyPolicy.findUnique({
    where: { companyId },
  });
  if (basePolicy) {
    await prisma.policyRuleSet.upsert({
      where: {
        companyId_code: { companyId, code: "DEFAULT" },
      },
      update: {},
      create: {
        companyId,
        code: "DEFAULT",
        name: "Default Rule Set",

        breakMinutes: basePolicy.breakMinutes,
        lateGraceMinutes: basePolicy.lateGraceMinutes,
        earlyLeaveGraceMinutes: basePolicy.earlyLeaveGraceMinutes,

        breakAutoDeductEnabled: basePolicy.breakAutoDeductEnabled,
        offDayEntryBehavior: basePolicy.offDayEntryBehavior,
        overtimeEnabled: basePolicy.overtimeEnabled,
        leaveEntryBehavior: basePolicy.leaveEntryBehavior,

        graceAffectsWorked: basePolicy.graceAffectsWorked,
        exitConsumesBreak: basePolicy.exitConsumesBreak,
        maxSingleExitMinutes: basePolicy.maxSingleExitMinutes,
        maxDailyExitMinutes: basePolicy.maxDailyExitMinutes,
        exitExceedAction: basePolicy.exitExceedAction,

        graceMode: basePolicy.graceMode,
        workedCalculationMode: basePolicy.workedCalculationMode,
        otBreakInterval: basePolicy.otBreakInterval,
        otBreakDuration: basePolicy.otBreakDuration,

        attendanceOwnershipMode: basePolicy.attendanceOwnershipMode,
        minimumRestMinutes: basePolicy.minimumRestMinutes,
        ownershipEarlyInMinutes: basePolicy.ownershipEarlyInMinutes,
        ownershipLateOutMinutes: basePolicy.ownershipLateOutMinutes,
        ownershipNextShiftLookaheadMinutes: basePolicy.ownershipNextShiftLookaheadMinutes,
        unscheduledWorkBehavior: basePolicy.unscheduledWorkBehavior,
      },
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
      role: UserRole.SYSTEM_ADMIN,
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.SYSTEM_ADMIN,
      isActive: true,
    },
    select: { id: true, email: true, role: true, isActive: true },
  });

  console.log("Seeded admin:", user);

    // 2.1) Seed default enterprise roles (config / ops / supervisor)
  const defaultPass = process.env.SEED_DEFAULT_PASSWORD ?? "Turnike123!";
  const defaultHash = await bcrypt.hash(defaultPass, 12);

  const configUser = await prisma.user.upsert({
    where: { email: "config@local" },
    update: { passwordHash: defaultHash, role: UserRole.HR_CONFIG_ADMIN, isActive: true },
    create: { email: "config@local", passwordHash: defaultHash, role: UserRole.HR_CONFIG_ADMIN, isActive: true },
    select: { id: true, email: true, role: true, isActive: true },
  });

  const opsUser = await prisma.user.upsert({
    where: { email: "ops@local" },
    update: { passwordHash: defaultHash, role: UserRole.HR_OPERATOR, isActive: true },
    create: { email: "ops@local", passwordHash: defaultHash, role: UserRole.HR_OPERATOR, isActive: true },
    select: { id: true, email: true, role: true, isActive: true },
  });

  const supervisorUser = await prisma.user.upsert({
    where: { email: "supervisor@local" },
    update: { passwordHash: defaultHash, role: UserRole.SUPERVISOR, isActive: true },
    create: { email: "supervisor@local", passwordHash: defaultHash, role: UserRole.SUPERVISOR, isActive: true },
    select: { id: true, email: true, role: true, isActive: true },
  });

  console.log("Seeded config:", configUser);
  console.log("Seeded ops:", opsUser);
  console.log("Seeded supervisor:", supervisorUser);
  console.log("Default password for these 3 users:", defaultPass);

  
  console.log("Active company id:", companyId);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
