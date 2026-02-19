export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { authErrorResponse } from "@/src/utils/api";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // ✅ Next 16: params Promise
) {
  try {
    // CONFIG: update device master (door binding)
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);

    const companyId = await getActiveCompanyId();

    // ✅ params'ı await ile aç
    const { id } = await ctx.params;
    const deviceId = String(id ?? "").trim();

    const body = await req.json().catch(() => ({} as any));
    const doorId = body.doorId ? String(body.doorId).trim() : null;

    if (!deviceId) {
      return NextResponse.json({ error: "id boş geldi" }, { status: 400 });
    }

  // Debug için önce id ile bul
    const existing = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, companyId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cihaz bulunamadı", id: deviceId }, { status: 404 });
    }

    if (existing.companyId !== companyId) {
      return NextResponse.json(
        {
          error: "Cihaz başka şirkete ait",
          id: deviceId,
          deviceCompanyId: existing.companyId,
          activeCompanyId: companyId,
        },
        { status: 403 }
      );
    }

  // door doğrulama (doorId verildiyse)
    if (doorId) {
      const door = await prisma.door.findFirst({
        where: { id: doorId, companyId },
        select: { id: true },
      });
      if (!door) {
        return NextResponse.json({ error: "Kapı bulunamadı", doorId }, { status: 400 });
      }
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { doorId },
      select: { id: true, doorId: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return authErrorResponse(err);
  }
}