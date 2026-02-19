// src/auth/jwt.ts
import jwt from "jsonwebtoken";

export type JwtPayload = {
  sub: string; // userId
  role: "SYSTEM_ADMIN" | "HR_CONFIG_ADMIN" | "HR_OPERATOR" | "SUPERVISOR";
};

const secret = () => {
  // AUTH_JWT_SECRET yoksa JWT_SECRET veya NEXTAUTH_SECRET'e bak
  const s = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error("AUTH_JWT_SECRET is missing");
  }
  return s;
};

export function signSession(payload: JwtPayload) {
  return jwt.sign(payload, secret(), {
    expiresIn: "7d",
  });
}

export function verifySession(token: string): JwtPayload {
  return jwt.verify(token, secret()) as JwtPayload;
}
