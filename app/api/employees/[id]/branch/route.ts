import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";

async function requireAdminOrHr() {
  const s = await getSessionOrNull();
  if (!s) return null;
  if (s.role !== UserRole.SYSTEM_ADMIN && s.role !== UserRole.HR_OPERATOR) return null;
  return s;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminOrHr();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const companyId = await getActiveCompanyId();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  const branchIdRaw = body?.branchId ?? null;
  const branchId = branchIdRaw ? String(branchIdRaw).trim() : null;

  // Employee doğrula
  const emp = await prisma.employee.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!emp) return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });

  if (branchId) {
    const br = await prisma.branch.findFirst({ where: { id: branchId, companyId }, select: { id: true } });
    if (!br) return NextResponse.json({ error: "BRANCH_NOT_FOUND" }, { status: 400 });
  }

  await prisma.employee.update({
    where: { id },
    data: { branchId },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
