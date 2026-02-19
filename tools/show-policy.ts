import { prisma } from "@/src/repositories/prisma";

async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error("Usage: tools/show-policy.ts <companyId>");
    process.exit(1);
  }

  const policy = await prisma.companyPolicy.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  console.log(policy);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
