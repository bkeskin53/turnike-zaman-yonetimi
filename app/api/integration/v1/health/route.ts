import { NextRequest, NextResponse } from "next/server";
import { requireIntegrationApiKey } from "@/src/services/integrationAuth.service";

export async function GET(req: NextRequest) {
  const auth = requireIntegrationApiKey(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.code, message: auth.message } },
      { status: auth.status }
    );
  }

  return NextResponse.json({
    ok: true,
    integration: "v1",
  });
}
