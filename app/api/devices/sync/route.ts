import { NextResponse } from "next/server";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function POST(req: Request) {
  const companyId = await getActiveCompanyId();
  const body = await req.json().catch(() => ({} as any));

  const deviceId = String(body.deviceId ?? "").trim();
  const count = Number(body.count ?? 5);

  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });

  const device = await prisma.device.findFirst({
    where: { id: deviceId, companyId, isActive: true },
    select: { id: true, doorId: true },
  });

  if (!device) return NextResponse.json({ error: "Cihaz bulunamadı" }, { status: 404 });

  const n = Math.max(1, Math.min(50, Number.isFinite(count) ? count : 5));
  const takeEmp = Math.max(2, Math.min(10, n));

  const employees = await prisma.employee.findMany({
    where: { companyId, isActive: true },
    take: takeEmp,
    select: { id: true },
    orderBy: [{ employeeCode: "asc" }],
  });

  if (employees.length === 0) {
    return NextResponse.json(
      { error: "Aktif personel yok. Önce Employees’den personel ekleyin." },
      { status: 400 }
    );
  }

  const now = new Date();

  // ✅ Bu sync çağrısının üreteceği zaman aralığı (dakika dakika geriye gidiyoruz)
  const minOccurredAt = new Date(now.getTime() - n * 60_000 - 2_000);
  const maxOccurredAt = new Date(now.getTime() + 2_000);

  const employeeIds = employees.map((e) => e.id);

  // ✅ Aynı dakika içinde aynı personele IN zaten var mı? (DB’deki mevcutları çek)
  const [existingIn, existingOut] = await Promise.all([
    prisma.rawEvent.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        direction: "IN",
        source: "DEVICE",
        occurredAt: { gte: minOccurredAt, lte: maxOccurredAt },
      },
      select: { employeeId: true, occurredAt: true },
    }),
    prisma.rawEvent.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        direction: "OUT",
        source: "DEVICE",
        occurredAt: { gte: minOccurredAt, lte: maxOccurredAt },
      },
      select: { employeeId: true, occurredAt: true },
    }),
  ]);

  const existingInMinuteKeys = new Set(
    existingIn.map((x) => `${x.employeeId}|${Math.floor(new Date(x.occurredAt).getTime() / 60000)}`)
  );

  const existingOutMinuteKeys = new Set(
    existingOut.map((x) => `${x.employeeId}|${Math.floor(new Date(x.occurredAt).getTime() / 60000)}`)
  );

  // batch içinde de duplicate basmayalım
  const batchInMinuteKeys = new Set<string>();
  const batchOutMinuteKeys = new Set<string>();
  
  const data: Array<any> = [];
  let skippedSameMinuteIn = 0;
  let skippedSameMinuteOut = 0;

  for (let i = 0; i < n; i++) {
    const emp = employees[i % employees.length];
    const direction = i % 2 === 0 ? "IN" : "OUT";
    const occurredAt = new Date(now.getTime() - (n - i) * 60_000);

    // ✅ Kural: aynı dakikada iki cihazdan/iki sync’ten aynı personele IN/OUT gelmesin
    const minuteKey = `${emp.id}|${Math.floor(occurredAt.getTime() / 60000)}`;

    // ✅ Kural: aynı dakikada duplicate IN engeli
    if (direction === "IN") {
      if (existingInMinuteKeys.has(minuteKey) || batchInMinuteKeys.has(minuteKey)) {
        skippedSameMinuteIn++;
        continue;
      }
      batchInMinuteKeys.add(minuteKey);
    }

    // ✅ Kural: aynı dakikada duplicate OUT engeli
    if (direction === "OUT") {
      if (existingOutMinuteKeys.has(minuteKey) || batchOutMinuteKeys.has(minuteKey)) {
        skippedSameMinuteOut++;
        continue;
      }
      batchOutMinuteKeys.add(minuteKey);
    }

    data.push({
      companyId,
      employeeId: emp.id,
      occurredAt,
      direction: direction as any,
      source: "DEVICE" as any,
      deviceId: device.id,
      doorId: device.doorId ?? null,
    });
  }

  await prisma.$transaction([
    prisma.rawEvent.createMany({ data }),
    prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        lastSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    inserted: data.length,
    skippedSameMinuteIn,
    skippedSameMinuteOut,
  });
}
