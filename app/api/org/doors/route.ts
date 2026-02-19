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

    const rows = await prisma.door.findMany({
      where: { companyId },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        branchId: true,
        code: true,
        name: true,
        role: true,
        isActive: true,
        defaultDirection: true, // ✅ eklendi
      },
    });

    return NextResponse.json(rows);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    // CONFIG: create door
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
  } catch (err) {
    return authErrorResponse(err);
  }

  const companyId = await getActiveCompanyId();
  const body = await req.json().catch(() => ({} as any));

  const branchId = String(body.branchId ?? "").trim();
  const code = String(body.code ?? "").trim();
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "TIMEKEEPING").trim();

  // ✅ defaultDirection parse (IN | OUT | null)
  const ddRaw = String(body.defaultDirection ?? "").trim().toUpperCase();
  const defaultDirection = ddRaw === "IN" || ddRaw === "OUT" ? ddRaw : null;

  if (!branchId || !code || !name) {
    return NextResponse.json({ error: "branchId, code, name zorunlu" }, { status: 400 });
  }

  // basit doğrulama
  const allowed = new Set(["TIMEKEEPING", "ACCESS_ONLY", "BOTH"]);
  const safeRole = allowed.has(role) ? role : "TIMEKEEPING";

  const created = await prisma.door.create({
    data: {
      companyId,
      branchId,
      code,
      name,
      role: safeRole as any,
      isActive: true,
      defaultDirection: defaultDirection as any, // ✅ eklendi
    },
    select: {
      id: true,
      branchId: true,
      code: true,
      name: true,
      role: true,
      isActive: true,
      defaultDirection: true, // ✅ eklendi
    },
  });

  return NextResponse.json(created, { status: 201 });
}