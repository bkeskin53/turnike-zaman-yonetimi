// src/auth/cookies.ts
export const cookieName = () => process.env.AUTH_COOKIE_NAME ?? "turnike_session";

/**
 * Session çerezi için ayarları döner.
 * Üretim ortamında `secure` bayrağı varsayılan olarak aktiftir.
 * Yerel üretim build'lerinde HTTP üzerinden test yapabilmek için .env dosyasına
 * AUTH_COOKIE_SECURE=false ekleyebilirsiniz.
 */
export const cookieOptions = () => {
  const envSecure = process.env.AUTH_COOKIE_SECURE;
  const secure = envSecure !== undefined ? envSecure === "true" : process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 gün
  } as const;
};
