import crypto from "crypto";
import type { NextRequest } from "next/server";
import { enforceIntegrationIpAllowlist } from "@/src/services/integrationIpAllowlist.service";
import { createIntegrationSecurityLog } from "@/src/repositories/integrationSecurity.repo";

export type IntegrationAuthResult =
  | { ok: true; apiKeyHash: string; ip: string | null }
  | { ok: false; status: number; code: string; message: string };

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function getClientIp(req: NextRequest): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    // first ip
    const first = xf.split(",")[0]?.trim();
    return first || null;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim() || null;
  return null;
}

export function requireIntegrationApiKey(req: NextRequest): IntegrationAuthResult {
  // S6A: Optional IP allowlist gate (fail-closed when allowlist is configured)
  const ipCheck = enforceIntegrationIpAllowlist(req);
  if (!ipCheck.ok) {
    void createIntegrationSecurityLog({
      reason: "FORBIDDEN_IP",
      endpoint: req.nextUrl?.pathname ?? "",
      sourceIp: ipCheck.ip,
      userAgent: req.headers.get("user-agent"),
      details: { allowlist: true },
    });
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN_IP",
      message: "request IP is not allowed",
    };
  }

  const expected = String(process.env.INTEGRATION_API_KEY ?? "").trim();
  if (!expected) {
    void createIntegrationSecurityLog({
      reason: "CONFIG_ERROR",
      endpoint: req.nextUrl?.pathname ?? "",
      sourceIp: ipCheck.ip,
      userAgent: req.headers.get("user-agent"),
    });
    return {
      ok: false,
      status: 500,
      code: "CONFIG_ERROR",
      message: "INTEGRATION_API_KEY is not configured",
    };
  }

  const provided = String(req.headers.get("x-integration-api-key") ?? "").trim();
  if (!provided) {
    void createIntegrationSecurityLog({
      reason: "MISSING_API_KEY",
      endpoint: req.nextUrl?.pathname ?? "",
      sourceIp: ipCheck.ip,
      userAgent: req.headers.get("user-agent"),
    });
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "missing integration api key" };
  }
  if (provided !== expected) {
    void createIntegrationSecurityLog({
      reason: "INVALID_API_KEY",
      endpoint: req.nextUrl?.pathname ?? "",
      sourceIp: ipCheck.ip,
      userAgent: req.headers.get("user-agent"),
    });
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "invalid integration api key" };
  }

  // Use IP detected by allowlist service (supports INTEGRATION_TRUST_PROXY=1).
  // Fallback to legacy getClientIp for dev edge cases.
  const ip = ipCheck.ip ?? getClientIp(req);
  return { ok: true, apiKeyHash: sha256Hex(provided).slice(0, 64), ip };
}
