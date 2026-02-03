import { NextRequest, NextResponse } from "next/server";
import { requireIntegrationApiKey } from "@/src/services/integrationAuth.service";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function GET(req: NextRequest) {
  const auth = requireIntegrationApiKey(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.code, message: auth.message } },
      { status: auth.status }
    );
  }

  const companyId = await getActiveCompanyId();
  const { searchParams } = new URL(req.url);

  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 200);

  const items = await prisma.integrationSecurityLog.findMany({
    where: { companyId },
    orderBy: { receivedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ items });
}

export async function POST() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
