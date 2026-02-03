import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireIntegrationApiKey } from "@/src/services/integrationAuth.service";
import { integrationUpsertEmployees } from "@/src/services/integrationEmployees.service";

function pickRequestId(req: NextRequest) {
  const fromHeader = String(req.headers.get("x-request-id") ?? "").trim();
  if (fromHeader) return fromHeader.slice(0, 64);
  // Node 18+ has randomUUID
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return String(id).slice(0, 64);
}

export async function POST(req: NextRequest) {
  const requestId = pickRequestId(req);
  const auth = requireIntegrationApiKey(req);
  if (!auth.ok) {
    return NextResponse.json(
      { requestId, error: { code: auth.code, message: auth.message } },
      { status: auth.status }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { requestId, error: { code: "INVALID_REQUEST", message: "invalid json body" } },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const dryRun = String(searchParams.get("dryRun") ?? "").trim() === "1";

  const endpoint = "/api/integration/v1/employees/upsert";
  const res = await integrationUpsertEmployees(
    {
      sourceSystem: String(body?.sourceSystem ?? "").trim(),
      batchRef: body?.batchRef ? String(body.batchRef).trim() : null,
      employees: Array.isArray(body?.employees) ? body.employees : [],
      callback: body?.callback ?? null,
    },
    { requestId, endpoint, ip: auth.ip, apiKeyHash: auth.apiKeyHash, dryRun }
  );

  if (!res.ok) {
    return NextResponse.json(res.body, { status: res.status });
  }

  return NextResponse.json(res.body, { status: res.status });
}

export async function GET() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
