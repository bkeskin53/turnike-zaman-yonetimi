import { prisma } from "@/src/repositories/prisma";
import { verifyPassword } from "@/src/auth/password";

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, role: true, isActive: true },
  });

  if (!user) return null;
  if (!user.isActive) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return { id: user.id, email: user.email, role: user.role };
}
