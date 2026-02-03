import { NextRequest, NextResponse } from "next/server";
import { ImportProfileKind, UserRole } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { getSessionOrNull } from "@/src/auth/guard";

async function requireAdminOrHr() {
  const session = await getSessionOrNull();
  if (!session) return null;
  if (session.role !== UserRole.ADMIN && session.role !== UserRole.HR) return null;
  return session;
}

export async function GET() {
  const session = await requireAdminOrHr();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const companyId = await getActiveCompanyId();
  const row = await prisma.companyImportProfile.findUnique({
    where: { companyId_kind: { companyId, kind: ImportProfileKind.EMPLOYEES } },
    select: { id: true, kind: true, mapping: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, item: row ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdminOrHr();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const companyId = await getActiveCompanyId();
  const body = await req.json().catch(() => null);
  const mapping = body?.mapping ?? null;

  if (!mapping || typeof mapping !== "object") {
    return NextResponse.json({ error: "MAPPING_REQUIRED" }, { status: 400 });
  }

  const saved = await prisma.companyImportProfile.upsert({
    where: { companyId_kind: { companyId, kind: ImportProfileKind.EMPLOYEES } },
    create: {
      companyId,
      kind: ImportProfileKind.EMPLOYEES,
      mapping,
    },
    update: {
      mapping,
    },
    select: { id: true, kind: true, mapping: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, item: saved });
}