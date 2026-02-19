import AppShell from "@/app/_components/AppShellNoSSR";
import { requireRole } from "@/src/auth/guard";
import IntegrationSettingsClient from "./ui";

function maskSecret(s: string) {
  const v = String(s ?? "").trim();
  if (!v) return "—";
  if (v.length <= 6) return "******";
  return `${v.slice(0, 3)}…${v.slice(-3)}`;
}

function boolEnv(v: string | undefined) {
  return String(v ?? "").trim() === "1";
}

export default async function IntegrationSettingsPage() {
  await requireRole(["SYSTEM_ADMIN"]);

  const apiKey = String(process.env.INTEGRATION_API_KEY ?? "").trim();
  const allowlist = String(process.env.INTEGRATION_IP_ALLOWLIST ?? "").trim();
  const trustProxy = boolEnv(process.env.INTEGRATION_TRUST_PROXY);
  const maxBatch = String(process.env.INTEGRATION_MAX_BATCH_SIZE ?? "").trim();

  const cfg = {
    apiKeyMasked: maskSecret(apiKey),
    apiKeyConfigured: !!apiKey,
    allowlistRaw: allowlist || "",
    allowlistEnabled: !!allowlist,
    trustProxy,
    maxBatchSize: maxBatch ? Number(maxBatch) : null,
  };

  const warnings: string[] = [];
  if (!cfg.apiKeyConfigured) warnings.push("INTEGRATION_API_KEY tanımlı değil (entegrasyon çağrıları 500 döner).");
  if (cfg.allowlistEnabled && !cfg.allowlistRaw.includes("127.0.0.1") && !cfg.allowlistRaw.includes("::1")) {
    warnings.push("Allowlist aktif ama localhost yok. Local testlerde 403 alırsın (normal).");
  }
  if (cfg.trustProxy && !cfg.allowlistEnabled) {
    warnings.push("INTEGRATION_TRUST_PROXY=1 ama allowlist kapalı. Proxy arkasında isen allowlist önerilir.");
  }
  if (cfg.maxBatchSize !== null && (cfg.maxBatchSize < 1 || cfg.maxBatchSize > 5000)) {
    warnings.push("INTEGRATION_MAX_BATCH_SIZE alışılmadık bir değer. 1–5000 aralığı önerilir.");
  }

  return (
    <AppShell title="Integration Settings" subtitle="Env tabanlı entegrasyon güvenliği (read-only + helper)">
      <IntegrationSettingsClient cfg={cfg} warnings={warnings} />
    </AppShell>
  );
}
