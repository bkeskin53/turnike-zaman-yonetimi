export const runtime = "nodejs";

import { NextResponse } from "next/server";
import net from "net";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

function isIpv4(ip: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
}

function tcpPing(host: string, port: number, timeoutMs = 1500): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = new net.Socket();

    const done = (err?: Error) => {
      try { socket.destroy(); } catch {}
      if (err) reject(err);
      else resolve(Date.now() - start);
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => done());
    socket.once("timeout", () => done(new Error("TIMEOUT")));
    socket.once("error", (e) => done(e as Error));

    socket.connect(port, host);
  });
}

export async function POST(req: Request) {
  const companyId = await getActiveCompanyId();
  const body = await req.json().catch(() => ({} as any));
  const deviceId = String(body.deviceId ?? "").trim();

  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });

  const device = await prisma.device.findFirst({
    where: { id: deviceId, companyId },
    select: { id: true, ip: true, port: true },
  });

  if (!device) return NextResponse.json({ error: "Cihaz bulunamadı" }, { status: 404 });
  if (!device.ip || !isIpv4(device.ip)) {
    await prisma.device.update({
      where: { id: device.id },
      data: { lastErrorAt: new Date(), lastErrorMessage: "IP geçersiz veya boş" },
    });
    return NextResponse.json({ ok: false, error: "IP geçersiz veya boş" }, { status: 400 });
  }

  const port = device.port ?? 4370;

  try {
    const latencyMs = await tcpPing(device.ip, port, 1500);

    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    return NextResponse.json({ ok: true, latencyMs });
  } catch (e: any) {
    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: `PING_FAIL: ${e?.message ?? "unknown"}`,
      },
    });

    return NextResponse.json({ ok: false, error: "Ping başarısız" }, { status: 200 });
  }
}
