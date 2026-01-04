import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getCompanyBundle, updateCompanyPolicy } from "@/src/services/company.service";

export async function GET() {
  try {
    await requireRole(["ADMIN", "HR"]);
    const data = await getCompanyBundle();
    return NextResponse.json({ policy: data.policy });
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireRole(["ADMIN", "HR"]);
    const body = await req.json().catch(() => null);
    const data = await updateCompanyPolicy(body ?? {});
    return NextResponse.json({ policy: data.policy });
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
