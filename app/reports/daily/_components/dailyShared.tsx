import type { ReactNode } from "react";

export type DailyItem = any;
export type Tone = "neutral" | "info" | "good" | "warn" | "violet" | "danger";

export function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function toneStyles(tone: Tone) {
  switch (tone) {
    case "info":
      return { chip: "bg-sky-50 text-sky-800 ring-sky-200/70", soft: "border-sky-200/70 bg-gradient-to-b from-white to-sky-50/40" };
    case "good":
      return { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200/70", soft: "border-emerald-200/70 bg-gradient-to-b from-white to-emerald-50/35" };
    case "warn":
      return { chip: "bg-amber-50 text-amber-900 ring-amber-200/70", soft: "border-amber-200/70 bg-gradient-to-b from-white to-amber-50/45" };
    case "violet":
      return { chip: "bg-violet-50 text-violet-800 ring-violet-200/70", soft: "border-violet-200/70 bg-gradient-to-b from-white to-violet-50/40" };
    case "danger":
      return { chip: "bg-rose-50 text-rose-800 ring-rose-200/70", soft: "border-rose-200/70 bg-gradient-to-b from-white to-rose-50/40" };
    default:
      return { chip: "bg-zinc-100 text-zinc-700 ring-zinc-200/70", soft: "border-zinc-200/70 bg-white" };
  }
}

export function PillBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const t = toneStyles(tone);
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ring-1 ring-inset shadow-sm", t.chip)}>
      {children}
    </span>
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-lg bg-[linear-gradient(90deg,rgba(228,228,231,0.9),rgba(244,244,245,1),rgba(228,228,231,0.9))]",
        className
      )}
    />
  );
}

export function Button({
  variant = "secondary",
  disabled,
  onClick,
  children,
  title,
  type = "button",
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800"
      : variant === "danger"
      ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
      : variant === "ghost"
      ? "bg-transparent text-zinc-700 hover:bg-zinc-100"
      : "border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50";
  return (
    <button className={cx(base, styles)} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

export function formatShiftSourceTR(src: string | null | undefined): string {
  switch (src) {
    case "POLICY":
      return "Policy";
    case "WORK_SCHEDULE":
      return "Work Schedule";
    case "WEEK_TEMPLATE":
      return "Week Template";
    case "DAY_TEMPLATE":
      return "Day Template";
    case "CUSTOM":
      return "Custom";
    default:
      return src ? String(src) : "";
  }
}

export function formatPolicySourceTR(src: string | null | undefined): string {
  switch (src) {
    case "EMPLOYEE":
      return "Personel";
    case "EMPLOYEE_SUBGROUP":
      return "Alt Grup";
    case "EMPLOYEE_GROUP":
      return "Grup";
    case "BRANCH":
      return "Şube";
    case "COMPANY":
      return "Şirket (Default)";
    default:
      return src ? String(src) : "";
  }
}

export function buildPolicyTooltip(it: any): string {
  const src = formatPolicySourceTR(it.policySource);
  const code = (it.policyRuleSetCode ?? "").toString();
  const name = (it.policyRuleSetName ?? "").toString();
  const parts: string[] = [];
  if (src) parts.push(`Kaynak: ${src}`);
  if (code) parts.push(`Kod: ${code}`);
  if (name) parts.push(`Ad: ${name}`);
  if (!code && !name) parts.push("RuleSet: (atanmamış)");
  return parts.join("\n");
}

export function isOvernightBadge(badgeOrLabel: string | null | undefined): boolean {
  if (!badgeOrLabel) return false;
  return badgeOrLabel.includes("🌙") || badgeOrLabel.includes("+1");
}

export function buildShiftTooltip(it: any): string {
  const src = formatShiftSourceTR(it.shiftSource);
  const label = (it.shiftLabel ?? it.shiftSignature ?? "").toString();
  const badge = (it.shiftBadge ?? "").toString();
  const overnight = isOvernightBadge(badge || label) ? "Evet" : "Hayır";
  const parts = [];
  if (src) parts.push(`Kaynak: ${src}`);
  if (label) parts.push(`Vardiya: ${label}`);
  if (src || label) parts.push(`Gece: ${overnight}`);
  return parts.join("\n");
}

export function stripEmoji(input: string) {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function fmt(dt: any) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export function n0(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmtMin(v: any): string {
  return String(n0(v));
}

export function issuesBadge(anomalies: string[]) {
  const c = anomalies.length;
  if (!c) return { label: "—", cls: "bg-zinc-100 text-zinc-600" };
  if (c >= 3) return { label: `${c} issue`, cls: "bg-rose-50 text-rose-700" };
  return { label: `${c} issue`, cls: "bg-amber-50 text-amber-800" };
}

export function prettyAnomaly(code: string): string {
  switch (code) {
    case "LATE_OUT_CAPTURED":
      return "Geç OUT yakalandı (pencere dışı, ertesi güne sarkan çıkış bugünü kapattı)";
    case "MISSING_PUNCH":
      return "Eksik punch (IN/OUT eksik)";
    case "MISSING_IN":
      return "IN eksik";
    case "MISSING_OUT":
      return "OUT eksik";
    case "DUPLICATE_PUNCH":
      return "Duplicate punch";
    case "CONSECUTIVE_IN":
      return "Arka arkaya IN (önceki IN kapanmadan yeni IN)";
    case "CONSECUTIVE_OUT":
      return "Arka arkaya OUT (önceki OUT’tan sonra tekrar OUT)";
    case "ORPHAN_OUT":
      return "Yetim OUT (öncesinde kabul edilmiş IN yok)";
    case "UNSCHEDULED_WORK":
      return "Vardiya dışı fiili çalışma (planlanan vardiya ile uyuşmuyor)";
    case "OUTSIDE_SHIFT_IGNORED":
      return "Vardiya penceresi dışında punch (CLAMP: worked'e dahil edilmedi)";
    case "DUPLICATE_EVENT":
      return "Duplicate event (aynı kayıt tekrarlandı)";
    case "EARLY_IN":
      return "Vardiya öncesi giriş";
    case "LATE_IN":
      return "Geç giriş";
    case "EARLY_OUT":
      return "Erken çıkış";
    case "LATE_OUT":
      return "Geç çıkış";
    case "OVERNIGHT":
      return "Gece sınırı (+1) aşıldı";
    case "REST_VIOLATION":
      return "Minimum dinlenme süresi ihlali";
    case "SINGLE_EXIT_LIMIT_EXCEEDED":
      return "Tek çıkış süresi limiti aşıldı";
    case "DAILY_EXIT_LIMIT_EXCEEDED":
      return "Günlük toplam çıkış süresi limiti aşıldı";
    case "PUNCH_BEFORE_SHIFT":
      return "Vardiya başlamadan punch";
    case "PUNCH_AFTER_SHIFT":
      return "Vardiya bitince punch";
    default:
      return code;
  }
}

export function getCode(item: DailyItem) {
  return item.employee?.employeeCode ?? item.employeeCode ?? "";
}

export function getName(item: DailyItem) {
  if (item.employee?.firstName || item.employee?.lastName) {
    return `${item.employee?.firstName ?? ""} ${item.employee?.lastName ?? ""}`.trim();
  }
  return item.fullName ?? item.name ?? "";
}

export function badgeClass(kind: "ok" | "warn" | "bad" | "neutral") {
  if (kind === "ok") return "bg-emerald-50 text-emerald-700";
  if (kind === "warn") return "bg-amber-50 text-amber-800";
  if (kind === "bad") return "bg-rose-50 text-rose-700";
  return "bg-zinc-100 text-zinc-700";
}

export function statusBadge(status: string) {
  switch (status) {
    case "PRESENT":
      return { label: "MEVCUT", cls: badgeClass("ok") };
    case "ABSENT":
      return { label: "DEVAMSIZ", cls: badgeClass("bad") };
    case "OFF":
      return { label: "OFF", cls: badgeClass("neutral") };
    default:
      return { label: String(status ?? ""), cls: badgeClass("neutral") };
  }
}

export function reviewBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return { label: "APPROVED", cls: "bg-emerald-50 text-emerald-700" };
    case "REJECTED":
      return { label: "REJECTED", cls: "bg-rose-50 text-rose-700" };
    case "PENDING":
      return { label: "REVIEW", cls: "bg-amber-50 text-amber-800" };
    default:
      return null;
  }
}

export function safeText(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function shiftDisplay(it: any): string {
  const raw = String(it.shiftBadge ?? it.shiftLabel ?? it.shiftSignature ?? "—");
  return stripEmoji(raw) || "—";
}

export function policyRuleDisplay(it: any): string {
  return String(it.policyRuleSetCode ?? it.policyRuleSetName ?? "").trim() || "—";
}

export function metricCellTitle(label: string, value: any): string {
  return `${label}: ${fmtMin(value)}`;
}

export function SummaryMetric({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-600">{label}</span>
      <span className="tabular-nums text-right">{fmtMin(value)}</span>
    </div>
  );
}

