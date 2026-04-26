import { DateTime } from "luxon";

import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildDailyReportItems } from "@/src/services/reports/dailyReport.service";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";

function asISODate(d: string | null) {
  if (!d) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[\"\n\r,]/.test(s)) return `"${s.replace(/\"/g, '""')}"`;
  return s;
}

function fmtLocalDateTime(v: any, tz: string): string {
  if (!v) return "";
  try {
    // Prisma returns Date objects; sometimes strings can also flow in.
    const dt =
      v instanceof Date
        ? DateTime.fromJSDate(v, { zone: "utc" }).setZone(tz)
        : DateTime.fromISO(String(v), { zone: "utc" }).setZone(tz);

    if (!dt.isValid) return String(v ?? "");
    return dt.toFormat("yyyy-LL-dd HH:mm");
  } catch {
    return String(v ?? "");
  }
}

function toCSV(rows: Record<string, any>[], headers: { key: string; label: string }[]): string {
  const head = headers.map((h) => csvEscape(h.label)).join(",");
  const lines = rows.map((r) => headers.map((h) => csvEscape(r[h.key])).join(","));
  // UTF-8 BOM helps Excel (TR)
  return `\ufeff${head}\n${lines.join("\n")}`;
}

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) return new Response("UNAUTHORIZED", { status: 401 });

  const url = new URL(req.url);
  const date = asISODate(url.searchParams.get("date"));
  if (!date) return new Response("BAD_DATE", { status: 400 });

  const companyId = await getActiveCompanyId();
  const { company, policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";

  const employeeScopeWhere = await getEmployeeScopeWhereForSession(session);
  const items = await buildDailyReportItems({ companyId, date, tz, policy, employeeWhere: employeeScopeWhere });

  const headers = [
    { key: "date", label: "Tarih" },
    { key: "employeeCode", label: "Sicil" },
    { key: "fullName", label: "Ad Soyad" },
    { key: "status", label: "Durum" },
    { key: "firstIn", label: "İlk Giriş" },
    { key: "lastOut", label: "Son Çıkış" },
    { key: "workedMinutes", label: "Çalışma (dk)" },
    { key: "overtimeMinutes", label: "Fazla Mesai (dk)" },
    { key: "lateMinutes", label: "Geç (dk)" },
    { key: "earlyLeaveMinutes", label: "Erken (dk)" },
    { key: "shiftLabel", label: "Vardiya" },
    { key: "shiftSource", label: "Vardiya Kaynağı" },
    { key: "manualOverrideApplied", label: "Manuel Düzeltme" },
   { key: "anomalies", label: "Anomaliler" },
  ] as const;

  const rows = items.map((it: any) => ({
    date,
    employeeCode: it.employeeCode ?? "",
    fullName: it.fullName ?? "",
    status: it.status ?? "",
    firstIn: fmtLocalDateTime(it.firstIn, tz),
    lastOut: fmtLocalDateTime(it.lastOut, tz),
    workedMinutes: it.workedMinutes ?? 0,
    overtimeMinutes: it.overtimeMinutes ?? 0,
    lateMinutes: it.lateMinutes ?? 0,
    earlyLeaveMinutes: it.earlyLeaveMinutes ?? 0,
    shiftLabel: it.shiftLabel ?? "",
    shiftSource: it.shiftSource ?? "",
    manualOverrideApplied: it.manualOverrideApplied ? "Evet" : "Hayır",
    anomalies: Array.isArray(it.anomalies) ? it.anomalies.join(";") : "",
  }));

  const csv = toCSV(rows, headers as any);
  const safeCompany = (company?.name ?? "company").toString().replace(/[^a-zA-Z0-9_-]+/g, "-");
  const filename = `daily_${safeCompany}_${date}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
