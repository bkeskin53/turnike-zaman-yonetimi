import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import { prisma } from "@/src/repositories/prisma";
import { RecomputeStatus } from "@prisma/client";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SYSTEM_ADMIN"]);
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const url = new URL(req.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? "200"), 1), 500);

  const items = await prisma.recomputeRequirement.findMany({
    where: { status: RecomputeStatus.PENDING },
    take,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      companyId: true,
      reason: true,
      rangeStartDayKey: true,
      rangeEndDayKey: true,
      status: true,
      createdByUserId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    items: items.map((x) => ({
      ...x,
      createdAt: x.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SYSTEM_ADMIN"]);
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  try {
    const body = await req.json();

    const { rangeStartDayKey, rangeEndDayKey } = body ?? {};

    if (!rangeStartDayKey || !rangeEndDayKey) {
      return NextResponse.json(
        { error: "rangeStartDayKey and rangeEndDayKey required" },
        { status: 400 }
      );
    }

    const companyId = await getActiveCompanyId();

    const result = await markRecomputeRequired({
      companyId,
      rangeStartDayKey,
      rangeEndDayKey,
      reason: RecomputeReason.POLICY_UPDATE,
    });

    return NextResponse.json({
      ok: true,
      id: result.id,
      mergedStart: result.mergedStart,
      mergedEnd: result.mergedEnd,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}