import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildDailyReportItems } from "@/src/services/reports/dailyReport.service";

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
   // if (!["ADMIN", "HR"].includes(session.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
 
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
 
   const items = await buildDailyReportItems({ companyId, date, tz, policy });
  return NextResponse.json({ date, items });
 }
