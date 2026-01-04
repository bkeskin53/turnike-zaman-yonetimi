export const cookieName = () => process.env.AUTH_COOKIE_NAME ?? "turnike_session";

export const cookieOptions = () => ({
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});
