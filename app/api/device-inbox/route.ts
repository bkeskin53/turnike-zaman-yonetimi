export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { authErrorResponse } from "@/src/utils/api";
import { getEmployeeScopeWhereForSession, withCompanyEmployeeWhere } from "@/src/auth/scope";

export async function GET(req: Request) {
  try {
    // OPS: device inbox is operational
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);

    const companyId = await getActiveCompanyId();
    const url = new URL(req.url);

    const status = (url.searchParams.get("status") ?? "PENDING").toUpperCase();
    const take = Math.max(1, Math.min(200, Number(url.searchParams.get("take") ?? "50") || 50));

    const employeeWhere = await getEmployeeScopeWhereForSession(session);
    let scopedIdentity: { cardNos: string[]; userIds: string[] } | null = null;

    if (employeeWhere) {
      const emps = await prisma.employee.findMany({
        where: withCompanyEmployeeWhere(companyId, employeeWhere),
        select: { cardNo: true, deviceUserId: true },
        take: 5000,
      });

      const cardNos = Array.from(
        new Set(
          emps
            .map((e) => e.cardNo)
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        )
      );

      const userIds = Array.from(
        new Set(
          emps
            .map((e) => e.deviceUserId)
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        )
      );

      // Safety caps: prevent huge IN lists
      scopedIdentity = { cardNos: cardNos.slice(0, 2000), userIds: userIds.slice(0, 2000) };

      // V3 deny-by-default: scope empty => return empty
      if (scopedIdentity.cardNos.length === 0 && scopedIdentity.userIds.length === 0) {
        return NextResponse.json({ ok: true, rows: [] });
      }
    }

    const whereBase: any = {
      companyId,
      status: status as any, // PENDING | RESOLVED | IGNORED
    };

    if (employeeWhere) {
      const ors: any[] = [];
      if (scopedIdentity?.cardNos?.length) ors.push({ cardNo: { in: scopedIdentity.cardNos } });
      if (scopedIdentity?.userIds?.length) ors.push({ deviceUserId: { in: scopedIdentity.userIds } });
      ors.push({ resolvedEmployee: employeeWhere }); // for RESOLVED rows
      whereBase.OR = ors;
    }

    const rows = await prisma.deviceInboxEvent.findMany({
      where: whereBase,
      orderBy: [{ occurredAt: "desc" }],
      take,
      select: {
        id: true,
        occurredAt: true,
        direction: true,
        status: true,
        externalRef: true,
        cardNo: true,
        deviceUserId: true,
        device: { select: { id: true, name: true } },
        door: { select: { id: true, code: true, name: true } },
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return authErrorResponse(err);
  }
}