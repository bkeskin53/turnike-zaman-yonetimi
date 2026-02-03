import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import { getSessionOrNull } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { getCompanyBundle } from "@/src/services/company.service";

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const employeeId = searchParams.get("employeeId");

  if (!month || !employeeId) {
    return NextResponse.json(
      { error: "month and employeeId are required" },
      { status: 400 }
    );
  }

  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";

  const start = DateTime.fromISO(`${month}-01`, { zone: tz }).startOf("month");
  const end = start.endOf("month");

  const rows = await prisma.dailyAttendance.findMany({
    where: {
      employeeId,
      workDate: {
        gte: start.toJSDate(),
        lte: end.toJSDate(),
      },
      anomalies: {
        isEmpty: false,
      },
    },
    select: {
      workDate: true,
      anomalies: true,
    },
    orderBy: {
      workDate: "asc",
    },
  });

  const items = rows.map((r) => ({
    date: DateTime.fromJSDate(r.workDate, { zone: "utc" })
      .setZone(tz)
      .toISODate(),
    anomalies: r.anomalies ?? [],
  }));

  return NextResponse.json({ items });
}