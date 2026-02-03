// src/services/audit.service.ts
// Zero-migration audit logging (server-side). Output is structured JSON for easy ingestion.

export type AuditAction =
  | "SHIFT_ASSIGNMENTS_BULK_WEEK_TEMPLATE";

export function auditLog(input: {
  action: AuditAction;
  companyId: string;
  actorUserId: string;
  actorRole: string;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}) {
  // Keep it stable: one line JSON. Good for grep / log collectors.
  const entry = {
    ts: new Date().toISOString(),
    tag: "AUDIT",
    ...input,
  };

  // Do not throw from audit
  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  } catch {
    // ignore
  }
}