// src/auth/guard.ts
"use server";

import { cookies } from "next/headers";
import { cookieName } from "./cookies";
import { verifySession } from "./jwt";
import { prisma } from "@/src/repositories/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

export type Role = "SYSTEM_ADMIN" | "HR_CONFIG_ADMIN" | "HR_OPERATOR" | "SUPERVISOR";

async function ensureDevAdmin(): Promise<{ id: string; role: UserRole } | null> {
  // sadece dev bypass açıkken çalışır
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";

  if (!email || !password) return null;

  // varsa getir
  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true, role: true },
  });
  if (existing) return { id: existing.id, role: existing.role };

  // yoksa oluştur
  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.SYSTEM_ADMIN,
      isActive: true,
    },
    select: { id: true, role: true },
  });

  return created;
}

async function devBypassSessionOrNull(): Promise<{ userId: string; role: Role } | null> {
  // Demo/sales mode: allow bypass even on production builds, but ONLY when explicitly enabled.
  // Two locks:
  // - DEV_BYPASS_AUTH=1 (explicit)
  // - In production, additionally require DEMO_MODE=1
  const isProd = process.env.NODE_ENV === "production";
  const demoModeEnabled = process.env["DEMO_MODE"] === "1";
  if (isProd && !demoModeEnabled) return null;

  /**
   * IMPORTANT (Docker/Prod build):
   * Next.js can inline `process.env.X` at build time in some server bundles.
   * If the Docker image was built without DEV_BYPASS_AUTH=1, the bundle may hardcode it,
   * causing DEV_BYPASS_AUTH to be ignored at runtime.
   * Bracket access prevents build-time inlining and guarantees runtime env read.
   */
  if (process.env["DEV_BYPASS_AUTH"] !== "1") return null;

  try {
    // Önce aktif admin ara
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.SYSTEM_ADMIN, isActive: true },
      select: { id: true, role: true },
    });

    if (admin) {
      console.log("[auth] dev bypass: admin session created");
      return { userId: admin.id, role: admin.role as Role };
    }

    // Admin yoksa dev admin oluşturmayı dene
    const ensured = await ensureDevAdmin();
    if (ensured) {
      console.log("[auth] dev bypass: admin created from SEED_ADMIN_* and session granted");
      return { userId: ensured.id, role: ensured.role as Role };
    }

    // Fallback: aktif herhangi bir user
    const anyUser = await prisma.user.findFirst({
      where: { isActive: true },
      select: { id: true, role: true },
    });

    if (anyUser) {
      console.log("[auth] dev bypass: fallback user session created");
      return { userId: anyUser.id, role: anyUser.role as Role };
    }

    console.log("[auth] dev bypass: no active user found (seed not applied / wrong DB)");
    return null;
  } catch (err) {
    console.log("[auth] dev bypass failed", err);
    return null;
  }
}

export async function getSessionOrNull(): Promise<{ userId: string; role: Role } | null> {
  const cookieStore = await cookies();
  const name = cookieName();
  const cookie = cookieStore.get(name);
  const token = cookie?.value;

  if (process.env.NODE_ENV !== "production") {
    console.log(`[auth] cookieName = ${name}`);
    console.log(`[auth] hasCookie = ${!!cookie}`);
  }

  if (!token) {
    return await devBypassSessionOrNull();
  }

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
