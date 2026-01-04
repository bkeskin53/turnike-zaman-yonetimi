import { prisma } from "@/src/repositories/prisma";

export async function getSetting(key: string) {
  return prisma.systemSetting.findUnique({ where: { key } });
}

export async function upsertSetting(key: string, value: string) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
