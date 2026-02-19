import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { EventSource } from "@prisma/client";

function requireTestMode() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.TEST_MODE !== "1") return false;
  return true;
}

export async function DELETE(req: Request) {
  try {
    if (!requireTestMode()) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const companyId = await getActiveCompanyId();

    const url = new URL(req.url);
    const batchId = (url.searchParams.get("batchId") ?? "").trim();

    // Safety: only allow deleting TEST_SEED events.
    const where: any = {
      companyId,
      source: EventSource.TEST_SEED,
    };

    if (batchId) where.batchId = batchId;

    const deleted = await prisma.rawEvent.deleteMany({ where });

    return NextResponse.json({ ok: true, deletedCount: deleted.count, batchId: batchId || null });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;

    console.error("test cleanup-events error:", err);
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "server_error", message: process.env.NODE_ENV !== "production" ? message : undefined },
      { status: 500 },
    );
  }
}
