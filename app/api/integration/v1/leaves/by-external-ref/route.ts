import { NextRequest, NextResponse } from "next/server";
import { requireIntegrationApiKey } from "@/src/services/integrationAuth.service";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function GET(req: NextRequest) {
  const auth = requireIntegrationApiKey(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.code, message: auth.message } },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(req.url);
  const sourceSystem = String(searchParams.get("sourceSystem") ?? "").trim();
  const externalRef = String(searchParams.get("externalRef") ?? "").trim();

  if (!sourceSystem || !externalRef) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "sourceSystem and externalRef are required" } },
      { status: 400 }
    );
  }

  const companyId = await getActiveCompanyId();

  const link = await prisma.integrationLeaveLink.findFirst({
    where: {
      companyId,
      sourceSystem,
      externalRef,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
        },
      },
      leave: {
        select: {
          id: true,
          dateFrom: true,
          dateTo: true,
          type: true,
          note: true,
        },
      },
    },
  });

  if (!link) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "leave not found for externalRef" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    item: {
      sourceSystem,
      externalRef,
      employee: {
        id: link.employee.id,
        employeeCode: link.employee.employeeCode,
        fullName: `${link.employee.firstName} ${link.employee.lastName}`.trim(),
      },
      leave: {
        id: link.leave.id,
        dateFrom: link.leave.dateFrom,
        dateTo: link.leave.dateTo,
        type: link.leave.type,
        note: link.leave.note,
      },
      lastSeenAt: link.lastSeenAt,
      updatedAt: link.updatedAt,
    },
  });
}

export async function POST() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
