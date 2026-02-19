import { DateTime } from "luxon";

import { getSessionOrNull } from "@/src/auth/guard";
import { getCompanyBundle } from "@/src/services/company.service";
import { buildDailyReportItems } from "@/src/services/reports/dailyReport.service";

function isISODate(v: string | null) {
  if (!v) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  if (/[\r\n",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtLocalDateTime(v: any, tz: string): string {
  if (!v) return "";
  try {
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

function anomalyDetail(code: string): string {
  switch (code) {
    case "LATE_OUT_CAPTURED":
      return "Geç OUT yakalandı (pencere dışı, ertesi güne sarkan çıkış bugünü kapattı)";
    case "MISSING_PUNCH":
      return "Eksik punch (IN/OUT çifti tamamlanmamış)";
    case "MISSING_IN":
      return "IN eksik";
    case "MISSING_OUT":
      return "OUT eksik";
    case "CONSECUTIVE_IN":
      return "Arka arkaya IN (önceki IN kapanmadan yeni IN)";
    case "CONSECUTIVE_OUT":
      return "Arka arkaya OUT (önceki OUT’tan sonra tekrar OUT)";
    case "ORPHAN_OUT":
      return "Yetim OUT (öncesinde kabul edilmiş IN yok)";
    case "UNSCHEDULED_WORK":
      return "Vardiya dışı fiili çalışma (planlanan vardiya ile uyuşmuyor)";
    case "OUTSIDE_SHIFT_IGNORED":
      return "Vardiya penceresi dışında punch (CLAMP: worked'e dahil edilmedi)";
    case "DUPLICATE_PUNCH":
      return "Duplicate punch";
    case "DUPLICATE_EVENT":
      return "Duplicate event (aynı kayıt tekrarlandı)";
    case "EARLY_IN":
      return "Vardiya öncesi giriş";
    case "LATE_IN":
      return "Geç giriş";
    case "EARLY_OUT":
      return "Erken çıkış";
    case "LATE_OUT":
      return "Geç çıkış";
    case "OVERNIGHT":
      return "Gece sınırı (+1) aşıldı";
    case "PUNCH_BEFORE_SHIFT":
      return "Vardiya başlamadan punch";
    case "PUNCH_AFTER_SHIFT":
      return "Vardiya bitince punch";
    default:
      return code;
  }
}

export async function GET(req: Request) {
 const session = await getSessionOrNull();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isISODate(from) || !isISODate(to)) {
    return new Response(JSON.stringify({ error: "from/to required (YYYY-MM-DD)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const companyId = bundle.company.id;
  const policy = bundle.policy;

  const start = DateTime.fromISO(from!, { zone: tz }).startOf("day");
  const end = DateTime.fromISO(to!, { zone: tz }).startOf("day");
  if (!start.isValid || !end.isValid) {
    return new Response(JSON.stringify({ error: "invalid date range" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (end < start) {
    return new Response(JSON.stringify({ error: "to must be >= from" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Guard: export range max 62 days to prevent heavy loads
  const rangeDays = Math.floor(end.diff(start, "days").days) + 1;
  if (rangeDays > 62) {
    return new Response(JSON.stringify({ error: "range too large (max 62 days)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const header = [
    "date",
    "employeeCode",
    "fullName",
    "status",
    "shiftLabel",
    "firstIn",
    "lastOut",
    "workedMinutes",
    "overtimeMinutes",
    "lateMinutes",
    "earlyLeaveMinutes",
    "manualOverrideApplied",
    "anomalies",
    "anomalyDetails",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvCell).join(","));

  for (let d = start; d <= end; d = d.plus({ days: 1 })) {
    const dateISO = d.toFormat("yyyy-MM-dd");
    const items = await buildDailyReportItems({ companyId, date: dateISO, tz, policy });

    for (const it of items) {
      const anomaliesArr = Array.isArray(it.anomalies) ? it.anomalies : [];
      if (!anomaliesArr.length) continue;

      // Excel-friendly: render as bullet list within a single cell (keeps CSV machine-readable)
      // csvCell() will quote the value because it contains newlines.
      const anomalyDetails =
        anomaliesArr.length === 1
          ? anomalyDetail(anomaliesArr[0]!)
          : `• ${anomaliesArr.map(anomalyDetail).join("\n• ")}`;

      lines.push(
        [
          dateISO,
          it.employeeCode ?? "",
          it.fullName ?? "",
          it.status ?? "",
          it.shiftLabel ?? "",
          fmtLocalDateTime(it.firstIn, tz),
          fmtLocalDateTime(it.lastOut, tz),
          it.workedMinutes ?? 0,
          it.overtimeMinutes ?? 0,
          it.lateMinutes ?? 0,
          it.earlyLeaveMinutes ?? 0,
          it.manualOverrideApplied ? 1 : 0,
          anomaliesArr.join(";"),
          anomalyDetails,
       ].map(csvCell).join(",")
      );
    }
  }

  // Excel/TR: UTF-8 BOM
  const csv = "\ufeff" + lines.join("\r\n");
  const filename = `anomalies_${from}_${to}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}