import { NextResponse } from "next/server";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function GET() {
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
}

export async function POST(req: Request) {
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
