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

export async function POST(req: Request) {
  const session = await requireAdminOrHr();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const companyId = await getActiveCompanyId();
  const body = await req.json().catch(() => null);

  const employeeIds: string[] = Array.isArray(body?.employeeIds) ? body.employeeIds.map((x: any) => String(x)) : [];
  const filter = body?.filter ?? null;
  if (employeeIds.length === 0 && !filter) {
    return NextResponse.json({ error: "EMPLOYEE_IDS_REQUIRED" }, { status: 400 });
  }

  const branchIdRaw = body?.branchId ?? null;
  const branchId = branchIdRaw ? String(branchIdRaw).trim() : null;

  if (branchId) {
    const br = await prisma.branch.findFirst({ where: { id: branchId, companyId }, select: { id: true } });
    if (!br) return NextResponse.json({ error: "BRANCH_NOT_FOUND" }, { status: 400 });
  }

  const where: any = { companyId };

  if (employeeIds.length > 0) {
    where.id = { in: employeeIds };
  } else {
    // FILTERED mode: apply to all matching employees
    const q = String(filter?.q ?? "").trim();
    const status = String(filter?.status ?? "ALL").toUpperCase();
    const bf = filter?.branchId === null ? "" : String(filter?.branchId ?? "").trim();

    if (q) {
      where.OR = [
        { employeeCode: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
       { email: { contains: q, mode: "insensitive" } },
      ];
    }
    if (bf === "__NULL__") where.branchId = null;
    else if (bf) where.branchId = bf;
    // status filter burada sadece isActive yerine employmentPeriods ile yapılmalı; şimdilik ALL/branch/q yeterli.
    // (İstersen ACTIVE/PASSIVE filtresini de aynı mantıkla buraya eklerim.)
  }

  const r = await prisma.employee.updateMany({ where, data: { branchId } });

  return NextResponse.json({ ok: true, updatedCount: r.count });
}