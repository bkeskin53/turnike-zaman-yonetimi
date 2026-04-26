import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/auth/http";

function disabledResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "EMPLOYEE_BRANCH_ROUTE_DISABLED",
      message: "Toplu lokasyon atamaları artık /api/org/location-assignments/apply üzerinden history-safe olarak yapılmalıdır.",
    },
    { status: 405 },
  );
}

export async function POST() {
  try {
    await requireRole(ROLE_SETS.OPS_WRITE);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    throw err;
  }

  return disabledResponse();
}