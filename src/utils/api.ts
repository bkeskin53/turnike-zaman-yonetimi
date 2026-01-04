import { NextResponse } from "next/server";

export function authErrorResponse(err: unknown) {
  const msg = err instanceof Error ? err.message : "";

  if (msg === "UNAUTHORIZED") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (msg === "FORBIDDEN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
