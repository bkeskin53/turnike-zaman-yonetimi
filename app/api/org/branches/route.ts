import { NextResponse } from "next/server";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function GET() {
  const companyId = await getActiveCompanyId();
  const rows = await prisma.branch.findMany({
    where: { companyId },
    orderBy: [{ code: "asc" }],
    select: { id: true, code: true, name: true, isActive: true },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
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
}
