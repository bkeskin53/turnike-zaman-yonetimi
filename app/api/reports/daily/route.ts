import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { listDailyAttendance } from "@/src/repositories/attendance.repo";

function asISODate(d: string | null) {
  if (!d) return null;
  // beklenen: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // (İstersen role kontrol ekleyebiliriz: ADMIN/HR)
  // if (!["ADMIN", "HR"].includes(session.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(req.url);
  const date = asISODate(url.searchParams.get("date"));
  if (!date) return NextResponse.json({ error: "BAD_DATE" }, { status: 400 });

  const companyId = await getActiveCompanyId();

  // workDate DB’de UTC midnight tutuluyor varsayımı
  const workDate = new Date(`${date}T00:00:00.000Z`);

  const rows = await listDailyAttendance(companyId, workDate);

  // UI'nin stabil beklediği "flat" shape:
  const items = rows.map((r) => {
    const code = (r as any).employee?.employeeCode ?? "";
    const firstName = (r as any).employee?.firstName ?? "";
    const lastName = (r as any).employee?.lastName ?? "";
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeCode: code,
      fullName,
      status: r.status,

      firstIn: r.firstIn,
      lastOut: r.lastOut,

      workedMinutes: r.workedMinutes,
      lateMinutes: r.lateMinutes,
      earlyLeaveMinutes: r.earlyLeaveMinutes,
      overtimeMinutes: (r as any).overtimeMinutes ?? 0,

      anomalies: r.anomalies ?? [],
    };
  });

  return NextResponse.json({ date, items });
}
