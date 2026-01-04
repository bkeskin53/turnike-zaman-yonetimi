import { NextResponse } from "next/server";
import { authenticate } from "@/src/services/auth.service";
import { signSession } from "@/src/auth/jwt";
import { cookieName, cookieOptions } from "@/src/auth/cookies";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const email = (body?.email ?? "").toString().trim().toLowerCase();
  const password = (body?.password ?? "").toString();

  if (!email || !password) {
    return NextResponse.json({ error: "email_and_password_required" }, { status: 400 });
  }

  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = signSession({ sub: user.id, role: user.role });
  const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });

  res.cookies.set(cookieName(), token, cookieOptions());
  return res;
}
