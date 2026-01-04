import jwt from "jsonwebtoken";

export type JwtPayload = {
  sub: string; // userId
  role: "ADMIN" | "HR" | "USER";
};

const secret = () => {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s) throw new Error("AUTH_JWT_SECRET is missing");
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
