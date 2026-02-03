import { NextRequest, NextResponse } from "next/server";
import { requireIntegrationApiKey } from "@/src/services/integrationAuth.service";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = requireIntegrationApiKey(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.code, message: auth.message } },
      { status: auth.status }
    );
  }

  const companyId = await getActiveCompanyId();
  const { requestId } = await params;
  const id = String(requestId ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "requestId is required" } }, { status: 400 });
  }

  const item = await prisma.integrationLog.findFirst({
    where: { companyId, requestId: id },
    select: {
      requestId: true,
      endpoint: true,
      sourceSystem: true,
      batchRef: true,
      ip: true,
      apiKeyHash: true,
      receivedAt: true,
      processedAt: true,
      totalCount: true,
      createdCount: true,
      updatedCount: true,
      unchangedCount: true,
      failedCount: true,
      status: true,
      errors: true,
      payloadMeta: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "integration log not found" } }, { status: 404 });
  }

  return NextResponse.json({ item });
}
