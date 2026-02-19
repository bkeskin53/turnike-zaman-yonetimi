import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getCompanyBundle, updateCompanyPolicy } from "@/src/services/company.service";

function toBool(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const data = await getCompanyBundle();
    return NextResponse.json({ policy: data.policy });
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    // Minimal normalize: boolean + new optional ints
    const payload = {
      ...(body ?? {}),
      overtimeEnabled: toBool(body?.overtimeEnabled),
      breakAutoDeductEnabled: toBool(body?.breakAutoDeductEnabled),
    };

    const data = await updateCompanyPolicy(payload);
    return NextResponse.json({ policy: data.policy });
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
