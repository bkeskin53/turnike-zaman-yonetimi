import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { authErrorResponse } from "@/src/utils/api";

export async function GET() {
  try {
    // Read-only stats (must be authenticated)
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);

    const companyId = await getActiveCompanyId();

  const grouped = await prisma.employee.groupBy({
    by: ["branchId"],
    where: { companyId },
    _count: { _all: true },
  });

  const branches = await prisma.branch.findMany({
    where: { companyId },
    select: { id: true, code: true, name: true },
    orderBy: [{ name: "asc" }],
  });
  const byId = new Map(branches.map((b) => [b.id, b]));

  const items = grouped
    .map((g) => {
      const b = g.branchId ? byId.get(g.branchId) : null;
      return {
        branchId: g.branchId,
        branch: b,
        count: g._count._all,
      };
    })
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

    return NextResponse.json({ items });
  } catch (err) {
    return authErrorResponse(err);
  }
}