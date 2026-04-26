import { getSessionOrNull } from "@/src/auth/guard";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildDailyPuantajRows } from "@/src/services/puantaj/buildDailyPuantajRows";
import { getDailyExportProfile } from "@/src/services/puantaj/exportProfiles";
import { renderDailyPuantajRowsCsv } from "@/src/services/puantaj/toCsv";

function isValidMonth(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value);
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
  const month = url.searchParams.get("month");
  const employeeId = url.searchParams.get("employeeId");
  const profileRaw = url.searchParams.get("profile");

  if (!isValidMonth(month)) {
    return new Response(JSON.stringify({ error: "bad_month" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let profile: ReturnType<typeof getDailyExportProfile>;
  try {
    profile = getDailyExportProfile(profileRaw);
  } catch {
    return new Response(JSON.stringify({ error: "bad_profile" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const companyId = await getActiveCompanyId();
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";

  const scopeWhere = await getEmployeeScopeWhereForSession(session);
  const employeeWhere = employeeId
    ? {
        AND: [scopeWhere ?? {}, { id: employeeId }],
      }
    : scopeWhere;

  const items = await buildDailyPuantajRows({
    companyId,
    month,
    tz,
    employeeWhere,
 });

  let csv = "";
  const suffix = employeeId ? `-${employeeId}` : "-all";
  let fileName = "";

  switch (profile) {
    case "STANDARD_DAILY":
      csv = renderDailyPuantajRowsCsv(items);
      fileName = `puantaj-daily-${month}${suffix}.csv`;
      break;
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}