// src/auth/kiosk.ts
import { getSessionOrNull } from "@/src/auth/guard";

export type KioskAccess =
  | { ok: true; mode: "KIOSK" }
  | { ok: false; status: 401 | 403 | 500; error: string };

/**
 * Kiosk access model:
 * - All roles (including SYSTEM_ADMIN): must provide x-kiosk-pin header matching process.env.KIOSK_PIN
 * - If KIOSK_PIN is not set: kiosk is "disabled" for non-admin (enterprise safe default)
 */
export async function requireKioskOrAdmin(req: Request): Promise<KioskAccess> {
  // Keep session check only for having a logged-in context if you want,
  // but it does NOT grant access without PIN anymore.
  await getSessionOrNull();

  const envPin = String(process.env.KIOSK_PIN ?? "").trim();
  if (!envPin) {
    // Safe default: kiosk disabled unless admin
    return { ok: false, status: 403, error: "KIOSK_DISABLED" };
  }

  const pin = String(req.headers.get("x-kiosk-pin") ?? "").trim();
  if (!pin) return { ok: false, status: 401, error: "KIOSK_PIN_REQUIRED" };
  if (pin !== envPin) return { ok: false, status: 401, error: "KIOSK_PIN_INVALID" };

  return { ok: true, mode: "KIOSK" };
}