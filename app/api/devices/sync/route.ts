export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getActiveCompanyId } from "@/src/services/company.service";
import { syncDevice } from "@/src/services/deviceSync.service";

export async function POST(req: Request) {
  const companyId = await getActiveCompanyId();
  const body = await req.json().catch(() => ({} as any));

  const deviceId = String(body.deviceId ?? "").trim();
  const count = Number(body.count ?? 5);

  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });

  try {
    const result = await syncDevice(companyId, { deviceId, count });

    // UI tarafı bazı alanları okuyabiliyor; sözleşmeyi bozmayalım.
    return NextResponse.json({
      ...result,
      ok: true,
      driver: result.driverUsed, // debug
    });
  } catch (e: any) {
    const msg = e?.message ?? "unknown";

    if (msg === "DEVICE_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "Cihaz bulunamadı" }, { status: 404 });
    }
    if (msg === "VALIDATION_ERROR") {
      return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
    }

    // REAL modda driver'lar henüz boşsa
    if (msg.includes("NOT_IMPLEMENTED")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bu driver REAL modda henüz hazır değil. (Şimdilik SIMULATOR modunda devam edin)",
        },
        { status: 501 }
      );
    }

    return NextResponse.json({ ok: false, error: "Sync başarısız" }, { status: 200 });
  }
}
