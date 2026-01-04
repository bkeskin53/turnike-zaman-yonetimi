import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { UserRole } from "@prisma/client";

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

  const items = await prisma.employee.findMany({
    where: { companyId },
    orderBy: [{ employeeCode: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminOrHr();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const companyId = await getActiveCompanyId();
  const body = await req.json();

  const employeeCode = String(body.employeeCode ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = body.email ? String(body.email).trim() : null;
  const isActive = body.isActive === false ? false : true;

  if (!employeeCode) return NextResponse.json({ error: "EMPLOYEE_CODE_REQUIRED" }, { status: 400 });
  if (!firstName) return NextResponse.json({ error: "FIRST_NAME_REQUIRED" }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: "LAST_NAME_REQUIRED" }, { status: 400 });

  const item = await prisma.employee.create({
    data: {
      companyId,
      employeeCode,
      firstName,
      lastName,
      email,
      isActive,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdminOrHr();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const companyId = await getActiveCompanyId();
  const body = await req.json();

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });

  // Soft delete / update: isActive dahil her şeyi güncelleyebiliriz
  const data: any = {};
  if (body.employeeCode !== undefined) data.employeeCode = String(body.employeeCode).trim();
  if (body.firstName !== undefined) data.firstName = String(body.firstName).trim();
  if (body.lastName !== undefined) data.lastName = String(body.lastName).trim();
  if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null;
  if (body.isActive !== undefined) data.isActive = !!body.isActive;

  const item = await prisma.employee.update({
    where: { id, companyId },
    data,
  });

  return NextResponse.json({ item });
}

// DELETE YOK: Hard delete projeden kaldırıldı.
export async function DELETE() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
