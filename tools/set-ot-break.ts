import { prisma } from "@/src/repositories/prisma";

async function main() {
  const companyId = process.argv[2];
  const intervalRaw = process.argv[3] ?? "180";
  const durationRaw = process.argv[4] ?? "30";

  if (!companyId) {
    console.error("Usage: tools/set-ot-break.ts <companyId> [interval] [duration]");
    process.exit(1);
  }

  const interval = Number(intervalRaw);
  const duration = Number(durationRaw);

  if (!Number.isFinite(interval) || interval <= 0) {
    throw new Error(`Invalid interval: ${intervalRaw} (must be > 0)`);
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid duration: ${durationRaw} (must be > 0)`);
  }

  const policy = await prisma.companyPolicy.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  if (!policy) {
    throw new Error(`No CompanyPolicy found for companyId=${companyId}`);
  }

  const updated = await prisma.companyPolicy.update({
    where: { id: policy.id },
    data: { otBreakInterval: interval, otBreakDuration: duration, overtimeEnabled: true, },
    select: { id: true, companyId: true, otBreakInterval: true, otBreakDuration: true, overtimeEnabled: true, },
  });

  console.log("Updated policy:", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
