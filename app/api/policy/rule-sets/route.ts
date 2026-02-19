import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { createPolicyRuleSetFromCompanyPolicy, listPolicyRuleSets } from "@/src/services/policyGroup.service";

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const data = await listPolicyRuleSets();
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    const code = String(body?.code ?? "").trim();
    const name = String(body?.name ?? "").trim();
    if (!code) return NextResponse.json({ error: "CODE_REQUIRED" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });

    const data = await createPolicyRuleSetFromCompanyPolicy({ code, name });
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
