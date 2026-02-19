import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { authErrorResponse } from "@/src/utils/api";

export async function GET() {
  try {
    // Read-only master data (must be authenticated)
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);

    const companyId = await getActiveCompanyId();
    const rows = await prisma.branch.findMany({
      where: { companyId },
      orderBy: [{ code: "asc" }],
      select: { id: true, code: true, name: true, isActive: true },
    });
    return NextResponse.json(rows);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    // CONFIG: create branch
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);

    const companyId = await getActiveCompanyId();
    const body = await req.json();

    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!code || !name) {
      return NextResponse.json({ error: "code ve name zorunlu" }, { status: 400 });
    }

    const created = await prisma.branch.create({
      data: { companyId, code, name, isActive: true },
      select: { id: true, code: true, name: true, isActive: true },
    });

    return NextResponse.json(created);
  } catch (err) {
    return authErrorResponse(err);
  }
}