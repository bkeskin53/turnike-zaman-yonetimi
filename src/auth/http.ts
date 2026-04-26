// src/auth/http.ts
// Shared HTTP helpers for auth/role errors.

import { NextResponse } from "next/server";

export function authErrorResponse(err: unknown) {
  const msg = (err as any)?.message ?? String(err);

  if (msg === "UNAUTHORIZED") {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (msg === "FORBIDDEN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Not an auth error → let the route decide.
  return null;
}
