import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { getIntegrationDashboardData } from "@/src/services/integrationDashboard.service";

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Array<Record<string, any>>, headers: string[]) {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape((r as any)[h])).join(","));
  }
  return lines.join("\n");
}

function safeFilename(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export async function GET(req: NextRequest) {
  await requireRole(["ADMIN", "HR"]);

  const { searchParams } = new URL(req.url);
  const hours = clampInt(searchParams.get("hours"), 24, 1, 168);
  const limit = clampInt(searchParams.get("limit"), 20, 5, 200);
  const kind = String(searchParams.get("kind") ?? "recentProblems").trim();

  const data = await getIntegrationDashboardData({ hours, limit });

  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");

  let csv = "";
  let filename = `integration_${kind}_${hours}h_${stamp}.csv`;

  if (kind === "byEndpoint") {
    const rows = (data.byEndpoint ?? []).map((r) => ({
      endpoint: r.endpoint,
      requests: r.requests,
      success: r.success,
      partial: r.partial,
      failed: r.failed,
    }));
    csv = toCsv(rows, ["endpoint", "requests", "success", "partial", "failed"]);
  } else if (kind === "bySourceSystem") {
    const rows = (data.bySourceSystem ?? []).map((r) => ({
      sourceSystem: r.sourceSystem,
      requests: r.requests,
      success: r.success,
      partial: r.partial,
      failed: r.failed,
   }));
    csv = toCsv(rows, ["sourceSystem", "requests", "success", "partial", "failed"]);
  } else if (kind === "securityRecent") {
    const rows = (data.security?.recent ?? []).map((r) => ({
      id: r.id,
      reason: r.reason,
      endpoint: r.endpoint,
      sourceIp: r.sourceIp,
      userAgent: r.userAgent,
      receivedAt: r.receivedAt,
    }));
    csv = toCsv(rows, ["id", "reason", "endpoint", "sourceIp", "userAgent", "receivedAt"]);
  } else if (kind === "securityByReason") {
    const rows = (data.security?.byReason ?? []).map((r) => ({
      reason: r.reason,
      count: r.count,
    }));
    csv = toCsv(rows, ["reason", "count"]);
  } else {
    // default: recentProblems
    const rows = (data.recentProblems ?? []).map((r) => ({
      requestId: r.requestId,
      status: r.status,
      endpoint: r.endpoint,
      sourceSystem: r.sourceSystem,
      batchRef: r.batchRef,
      totalCount: r.totalCount,
      failedCount: r.failedCount,
      receivedAt: r.receivedAt,
      processedAt: r.processedAt,
    }));
    csv = toCsv(rows, [
      "requestId",
      "status",
      "endpoint",
      "sourceSystem",
      "batchRef",
      "totalCount",
      "failedCount",
      "receivedAt",
      "processedAt",
    ]);
  }

  filename = safeFilename(filename);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
