import { NextRequest } from "next/server";

type Rule =
  | { kind: "ip"; ip: string }
  | { kind: "cidr"; base: number; maskBits: number; raw: string }
  | { kind: "ipv6"; raw: string }; // accepted only for exact matches (no cidr parsing)

function norm(s: string) {
  return s.trim();
}

function parseAllowlist(raw: string): Rule[] {
  const parts = raw
    .split(",")
    .map((x) => norm(x))
    .filter(Boolean);

  const rules: Rule[] = [];
  for (const p of parts) {
    if (p.includes(":")) {
      // IPv6: support exact match only (enterprise-safe, avoids partial parsing bugs).
      rules.push({ kind: "ipv6", raw: p });
      continue;
    }
    const slash = p.indexOf("/");
    if (slash > -1) {
      const ip = p.slice(0, slash).trim();
      const maskStr = p.slice(slash + 1).trim();
      const maskBits = Number(maskStr);
      const base = ipv4ToInt(ip);
      if (base === null) continue;
      if (!Number.isFinite(maskBits) || maskBits < 0 || maskBits > 32) continue;
      rules.push({ kind: "cidr", base, maskBits, raw: p });
      continue;
    }
    const v = ipv4ToInt(p);
    if (v !== null) rules.push({ kind: "ip", ip: p });
  }
  return rules;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!part) return null;
    const v = Number(part);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  // ensure unsigned
  return n >>> 0;
}

function isInCidr(ipInt: number, base: number, maskBits: number) {
  if (maskBits === 0) return true;
  const mask = maskBits === 32 ? 0xffffffff : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

function pickClientIp(req: NextRequest): string | null {
  const trustProxy = String(process.env.INTEGRATION_TRUST_PROXY ?? "").trim() === "1";
  if (trustProxy) {
    const xff = String(req.headers.get("x-forwarded-for") ?? "").trim();
    if (xff) {
      // first IP in list is original client in typical setups
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const xrip = String(req.headers.get("x-real-ip") ?? "").trim();
    if (xrip) return xrip;
  }
  // NextRequest.ip may be null in dev
  const ip = (req as any).ip ? String((req as any).ip) : "";
  if (ip) return ip.trim();
  // fallback: try x-forwarded-for even if not trusting proxy (local dev convenience)
  const xff = String(req.headers.get("x-forwarded-for") ?? "").trim();
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return null;
}

export function enforceIntegrationIpAllowlist(req: NextRequest): { ok: true; ip: string | null } | { ok: false; ip: string | null } {
  const allowRaw = String(process.env.INTEGRATION_IP_ALLOWLIST ?? "").trim();
  const ip = pickClientIp(req);
  if (!allowRaw) {
    return { ok: true, ip };
  }
  if (!ip) {
    return { ok: false, ip: null };
  }

  const rules = parseAllowlist(allowRaw);
  if (rules.length < 1) {
    // malformed allowlist -> fail closed (enterprise-safe)
    return { ok: false, ip };
  }

  // IPv6 exact match only
  if (ip.includes(":")) {
    const ok = rules.some((r) => r.kind === "ipv6" && r.raw === ip);
    return ok ? { ok: true, ip } : { ok: false, ip };
  }

  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return { ok: false, ip };

  for (const r of rules) {
    if (r.kind === "ip" && r.ip === ip) return { ok: true, ip };
    if (r.kind === "cidr" && isInCidr(ipInt, r.base, r.maskBits)) return { ok: true, ip };
  }
  return { ok: false, ip };
}
