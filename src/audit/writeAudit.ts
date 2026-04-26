import { prisma } from "@/src/repositories/prisma";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";

export async function writeAudit(input: {
  req?: NextRequest | Request;
  actorUserId: string;
  actorRole: UserRole;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  details?: unknown;
}) {
  try {
    const req = input.req;
    const endpoint = req ? new URL(req.url).pathname : null;
    const method = (req as any)?.method ?? null;

    // Best-effort IP extraction (on-prem / reverse-proxy compatible)
    const xf = req ? req.headers.get("x-forwarded-for") ?? "" : "";
    const sourceIp =
      (xf.split(",")[0]?.trim() ||
        (req ? req.headers.get("x-real-ip") : null) ||
        (req ? req.headers.get("cf-connecting-ip") : null) ||
        null) ?? null;

    const userAgent = req ? req.headers.get("user-agent") ?? null : null;

    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        endpoint,
        method,
        sourceIp,
        userAgent,
        details: (typeof input.details === "undefined" ? null : (input.details as any)) ?? null,
      },
    });
  } catch (e) {
    // Audit failure must not block critical admin operations in v1.
    // You can tighten this later (fail-open -> fail-closed) if compliance demands it.
    console.warn("[audit] writeAudit failed:", e);
  }
}