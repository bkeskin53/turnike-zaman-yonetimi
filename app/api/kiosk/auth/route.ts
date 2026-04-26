// app/api/kiosk/auth/route.ts
import { NextResponse } from "next/server";
import { requireKioskOrAdmin } from "@/src/auth/kiosk";

export async function GET(req: Request) {
  const access = await requireKioskOrAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }
  return NextResponse.json({ ok: true, mode: access.mode });
}