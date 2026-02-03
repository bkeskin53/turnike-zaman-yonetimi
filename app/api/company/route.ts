// app/api/company/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { adminUpdateCompanyName, getCompanyBundle } from "@/src/services/company.service";

export async function GET() {
  try {
    await requireRole(["ADMIN", "HR"]);
    const data = await getCompanyBundle();
    return NextResponse.json(data);
  } catch (err) {
    // Geliştirme ortamında hata mesajını logla
    if (process.env.NODE_ENV !== "production") {
      try {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[api/company] error = ${msg}`);
      } catch {}
    }
    const res = authErrorResponse(err);
    return res ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireRole(["ADMIN"]);
    const body = await req.json().catch(() => null);
    const name = (body?.name ?? "").toString().trim();
    if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

    const data = await adminUpdateCompanyName(name);
    return NextResponse.json(data);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      try {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[api/company][PUT] error = ${msg}`);
      } catch {}
    }
    const res = authErrorResponse(err);
    return res ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
