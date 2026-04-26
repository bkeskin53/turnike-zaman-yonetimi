import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildDailyReportItems } from "@/src/services/reports/dailyReport.service";
import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { getEmployeeScopeWhereForSession, withCompanyEmployeeWhere } from "@/src/auth/scope";

 function asISODate(d: string | null) {
   if (!d) return null;
   // beklenen: YYYY-MM-DD
   if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
   return d;
 }
 
 export async function GET(req: Request) {
   const session = await getSessionOrNull();
   if (!session) {
     if (process.env.NODE_ENV !== "production") {
       console.log("[api/reports/daily][GET] unauthorized");
     }
     return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
   }
 
   // (İstersen role kontrol ekleyebiliriz: ADMIN/HR)
   // if (!["SYSTEM_ADMIN", "HR_OPERATOR"].includes(session.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
 
   const url = new URL(req.url);
   const date = asISODate(url.searchParams.get("date"));
   if (!date) {
     if (process.env.NODE_ENV !== "production") {
       console.log("[api/reports/daily][GET] invalid_date");
     }
     return NextResponse.json({ error: "BAD_DATE" }, { status: 400 });
   }
 
   const companyId = await getActiveCompanyId();
   const { policy } = await getCompanyBundle();
   const tz = policy.timezone || "Europe/Istanbul";
 
   const employeeScopeWhere = await getEmployeeScopeWhereForSession(session);
   const items = await buildDailyReportItems({ companyId, date, tz, policy, employeeWhere: employeeScopeWhere });
  // -------------------------------------------------------------
   // Eksik-2: Employment validity dışında kalan personelleri raporla
   // (DailyAttendance üretmeyiz ama kullanıcıya "neden yok?" cevabı vermek için)
   const workDate = dbDateFromDayKey(date);

   const allEmployees = await prisma.employee.findMany({
     where: withCompanyEmployeeWhere(companyId, employeeScopeWhere),
     select: { id: true, employeeCode: true, firstName: true, lastName: true },
     orderBy: [{ employeeCode: "asc" }],
   });

   const employedIds = new Set(
     (
       await prisma.employee.findMany({
         where: {
           ...withCompanyEmployeeWhere(companyId, employeeScopeWhere),
           employmentPeriods: {
             some: {
               startDate: { lte: workDate },
               OR: [{ endDate: null }, { endDate: { gte: workDate } }],
             },
           },
         },
         select: { id: true },
       })
     ).map((x) => x.id),
   );

   const notEmployedBase = allEmployees.filter((e) => !employedIds.has(e.id));
   const notEmployedIds = notEmployedBase.map((e) => e.id);

   // Limit: detay listesi çok büyümesin (UI’da da yönetiyoruz)
   const MAX = 200;
   const notEmployedLimited = notEmployedIds.slice(0, MAX);

   const lastPeriods = notEmployedLimited.length
     ? await prisma.employeeEmploymentPeriod.findMany({
         where: { companyId, employeeId: { in: notEmployedLimited } },
         orderBy: [{ startDate: "desc" }],
         select: { employeeId: true, startDate: true, endDate: true, reason: true },
       })
     : [];

   // latest period per employee
   const latestByEmp = new Map<string, { startDate: Date; endDate: Date | null; reason: string | null }>();
   for (const p of lastPeriods) {
     if (!latestByEmp.has(p.employeeId)) {
       latestByEmp.set(p.employeeId, { startDate: p.startDate, endDate: p.endDate ?? null, reason: p.reason ?? null });
     }
   }

   function toISODateOnly(d: Date | null): string | null {
     if (!d) return null;
     // @db.Date values come as Date; represent as YYYY-MM-DD
     return d.toISOString().slice(0, 10);
   }

   const notEmployed = notEmployedBase.slice(0, MAX).map((e) => {
     const p = latestByEmp.get(e.id) ?? null;
     return {
       employeeId: e.id,
       employeeCode: e.employeeCode,
       fullName: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
       lastEmployment: p
         ? {
             startDate: toISODateOnly(p.startDate),
             endDate: toISODateOnly(p.endDate),
             reason: p.reason,
           }
         : null,
     };
   });

   return NextResponse.json({
     date,
     items,
     meta: {
       tz,
       exclusions: {
         notEmployed: {
           count: notEmployedBase.length,
           limited: notEmployed.length,
           limit: MAX,
           items: notEmployed,
         },
       },
     },
   });
 }
