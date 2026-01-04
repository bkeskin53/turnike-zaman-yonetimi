import { cookies } from "next/headers";
import { cookieName } from "./cookies";
import { verifySession } from "./jwt";

export type Role = "ADMIN" | "HR" | "USER";

export async function getSessionOrNull(): Promise<{ userId: string; role: Role } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  if (!token) return null;

  try {
    const payload = verifySession(token);
    return { userId: payload.sub, role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<{ userId: string; role: Role }> {
  const s = await getSessionOrNull();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}

export async function requireRole(roles: Role[]): Promise<{ userId: string; role: Role }> {
  const s = await requireSession();
  if (!roles.includes(s.role)) throw new Error("FORBIDDEN");
  return s;
}
