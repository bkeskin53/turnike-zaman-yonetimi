"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Bundle = {
  company: { id: string; name: string };
  policy: {
    id: string;
    companyId: string;

    timezone: string;
    shiftStartMinute: number;
    shiftEndMinute: number;
    breakMinutes: number;
    lateGraceMinutes: number;
    earlyLeaveGraceMinutes: number;

    breakAutoDeductEnabled: boolean;
    offDayEntryBehavior: "IGNORE" | "FLAG" | "COUNT_AS_OT";
    leaveEntryBehavior: "IGNORE" | "FLAG" | "COUNT_AS_OT";
    overtimeEnabled: boolean;
    /**
     * Enterprise: Overtime dynamic break
     * (nullable => disabled)
     */
    otBreakInterval?: number | null;
    otBreakDuration?: number | null;
    workedCalculationMode?: "ACTUAL" | "CLAMP_TO_SHIFT" | null;

    /**
     * Advanced / Optional policy fields
     * (varsayılan davranışı etkilemez)
     */
    graceAffectsWorked?: boolean | null;
    graceMode?: "ROUND_ONLY" | "PAID_PARTIAL" | null;
    exitConsumesBreak?: boolean | null;
    maxSingleExitMinutes?: number | null;
    maxDailyExitMinutes?: number | null;
    exitExceedAction?: "IGNORE" | "WARN" | "FLAG" | null;
  };
};

function minutesToHHMM(m: number) {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

function hhmmToMinutes(s: string) {
  const [h, m] = s.split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// ------------------------------------------------------------
// Mini Design System (Palette / Badges / Buttons / Icons)
// ------------------------------------------------------------
const DS = {
  ring: "focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
  card: "rounded-3xl border border-zinc-200 bg-white shadow-sm",
  softCard:
    "rounded-3xl border border-zinc-200 bg-gradient-to-br from-sky-50 via-white to-violet-50 shadow-sm",
  muted: "text-zinc-500",
};

type BadgeTone = "neutral" | "good" | "warn" | "danger" | "info" | "violet";

function toneClasses(t: BadgeTone) {
  switch (t) {
    case "good":
      return {
        pill: "border-emerald-200 bg-emerald-50 text-emerald-800",
        chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
        card: "border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-white",
      };
    case "warn":
      return {
        pill: "border-amber-200 bg-amber-50 text-amber-800",
        chip: "border-amber-200 bg-amber-50 text-amber-900",
        card: "border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white",
      };
    case "danger":
      return {
        pill: "border-red-200 bg-red-50 text-red-800",
        chip: "border-red-200 bg-red-50 text-red-800",
        card: "border-red-200/70 bg-gradient-to-br from-red-50 via-white to-white",
      };
    case "info":
      return {
        pill: "border-sky-200 bg-sky-50 text-sky-800",
        chip: "border-sky-200 bg-sky-50 text-sky-900",
        card: "border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-white",
      };
    case "violet":
      return {
        pill: "border-violet-200 bg-violet-50 text-violet-800",
        chip: "border-violet-200 bg-violet-50 text-violet-900",
        card: "border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-white",
      };
    default:
      return {
        pill: "border-zinc-200 bg-white/60 text-zinc-700",
        chip: "border-zinc-200 bg-zinc-50 text-zinc-700",
        card: "border-zinc-200 bg-white",
      };
  }
}

function Badge(props: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  const t = props.tone ?? "neutral";
  const tc = toneClasses(t);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tc.pill,
        props.className
      )}
    >
      {props.children}
    </span>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
function Button(props: {
  variant?: BtnVariant;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  onClick?: () => void;
}) {
  const v = props.variant ?? "secondary";
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold transition";
  const variants = {
    // Daha “ürün” hissi: mavi/indigo accent
    primary:
      "border border-indigo-700 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 hover:border-indigo-800",
    secondary:
      "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 shadow-sm",
    ghost: "border border-transparent bg-transparent text-zinc-700 hover:bg-zinc-50",
    danger: "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
  }[v];
  const disabled = props.disabled ? "cursor-not-allowed opacity-60" : "";
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={cx(base, variants, DS.ring, disabled, props.className)}
    >
      {props.children}
    </button>
  );
}

function IconChip(props: { tone?: BadgeTone; children: ReactNode }) {
  const t = props.tone ?? "neutral";
  const tc = toneClasses(t);
  return (
    <span
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-2xl border text-[16px] shadow-sm",
        tc.chip
      )}
    >
      {props.children}
    </span>
  );
}

function TonePill(props: { tone?: "neutral" | "good" | "warn"; children: ReactNode }) {
  const tone = props.tone ?? "neutral";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "neutral" && "border-zinc-200 bg-white/60 text-zinc-700"
      )}
    >
      {props.children}
    </span>
  );
}

function NavButton(props: { onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        "rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-left",
        "transition hover:bg-zinc-50",
        DS.ring
      )}
    >
      <div className="text-xs font-semibold text-zinc-900">{props.title}</div>
      <div className="mt-0.5 text-[11px] text-zinc-500">{props.desc}</div>
    </button>
  );
}

function FieldShell(props: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-medium text-zinc-600">{props.label}</span>
      {props.children}
      {props.hint ? <span className="text-[11px] text-zinc-500">{props.hint}</span> : null}
    </label>
  );
}

function InlineInfo(props: { tone?: "neutral" | "warn"; title: string; desc: ReactNode }) {
  const tone = props.tone ?? "neutral";
  return (
    <div
      className={cx(
        "rounded-2xl border p-3",
        tone === "warn" ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-zinc-50"
      )}
    >
      <div className={cx("text-xs font-semibold", tone === "warn" ? "text-amber-900" : "text-zinc-700")}>
        {props.title}
      </div>
      <div className={cx("mt-1 text-xs", tone === "warn" ? "text-amber-800" : "text-zinc-600")}>{props.desc}</div>
    </div>
  );
}

function ShortcutCard(props: {
  href: string;
  title: string;
  desc: ReactNode;
  badge?: string;
  icon?: string;
  tone?: BadgeTone;
}) {
  const tone = props.tone ?? "neutral";
  const tc = toneClasses(tone);
  return (
    <a
      href={props.href}
      className={cx(
        "group block rounded-3xl border p-4 shadow-sm",
        tc.card,
        "transition hover:-translate-y-0.5 hover:shadow-md",
        DS.ring
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {props.icon ? <IconChip tone={tone}>{props.icon}</IconChip> : null}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-950">{props.title}</div>
              <div className="mt-1 text-xs text-zinc-600">{props.desc}</div>
            </div>
          </div>
        </div>
        {props.badge ? (
          <Badge tone={tone}>{props.badge}</Badge>
        ) : null}
      </div>
      <div className="mt-3 text-xs font-medium text-zinc-700 group-hover:text-zinc-900">
        Aç →
      </div>
    </a>
  );
}

export default function CompanySettingsClient() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  const companyRef = useRef<HTMLDivElement | null>(null);
  const policyRef = useRef<HTMLDivElement | null>(null);
  const advancedRef = useRef<HTMLDivElement | null>(null);
  const scrollTo = (r: React.RefObject<HTMLDivElement | null>) => r.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [breakMin, setBreakMin] = useState(60);
  const [lateGrace, setLateGrace] = useState(5);
  const [earlyGrace, setEarlyGrace] = useState(5);

  const [breakAutoDeductEnabled, setBreakAutoDeductEnabled] = useState(true);
  const [offDayEntryBehavior, setOffDayEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("IGNORE");
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [workedCalculationMode, setWorkedCalculationMode] =
    useState<"ACTUAL" | "CLAMP_TO_SHIFT">("ACTUAL");

  // Enterprise: Overtime dynamic break (optional)
  const [otBreakInterval, setOtBreakInterval] = useState<string>("");
  const [otBreakDuration, setOtBreakDuration] = useState<string>("");

  // Behavior when punches occur on leave days
  const [leaveEntryBehavior, setLeaveEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("FLAG");

  // Advanced / Optional policy states
  const [graceAffectsWorked, setGraceAffectsWorked] = useState<boolean>(false);
  const [exitConsumesBreak, setExitConsumesBreak] = useState<boolean>(false);
  const [maxSingleExitMinutes, setMaxSingleExitMinutes] = useState<string>("");
  const [maxDailyExitMinutes, setMaxDailyExitMinutes] = useState<string>("");
  const [exitExceedAction, setExitExceedAction] =
    useState<"" | "IGNORE" | "WARN" | "FLAG">("");

  const canSave = useMemo(() => !!name && !!timezone, [name, timezone]);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  async function load() {
    setError(null);
    // include credentials so that session cookie is sent; disable caching
    const res = await fetch("/api/company", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      setError(`Load failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as Bundle;
    setBundle(data);

    setName(data.company.name);
    setTimezone(data.policy.timezone);
    setStart(minutesToHHMM(data.policy.shiftStartMinute));
    setEnd(minutesToHHMM(data.policy.shiftEndMinute));
    setBreakMin(data.policy.breakMinutes);
    setLateGrace(data.policy.lateGraceMinutes);
    setEarlyGrace(data.policy.earlyLeaveGraceMinutes);

    setBreakAutoDeductEnabled(Boolean(data.policy.breakAutoDeductEnabled));
    setOffDayEntryBehavior(data.policy.offDayEntryBehavior);
    setLeaveEntryBehavior(data.policy.leaveEntryBehavior ?? "FLAG");
    setOvertimeEnabled(Boolean(data.policy.overtimeEnabled));
    setWorkedCalculationMode((data.policy.workedCalculationMode ?? "ACTUAL") as any);

    // Enterprise: Overtime dynamic break (optional)
    setOtBreakInterval(
      data.policy.otBreakInterval != null ? String(data.policy.otBreakInterval) : ""
    );
    setOtBreakDuration(
      data.policy.otBreakDuration != null ? String(data.policy.otBreakDuration) : ""
    );

    // Advanced / Optional policy fields
    // Determine grace toggle based on graceMode (preferred) or graceAffectsWorked (legacy)
    if (data.policy.graceMode != null) {
      setGraceAffectsWorked(data.policy.graceMode === "PAID_PARTIAL");
    } else {
      setGraceAffectsWorked(Boolean(data.policy.graceAffectsWorked));
    }
    setExitConsumesBreak(Boolean(data.policy.exitConsumesBreak));

    setMaxSingleExitMinutes(
      data.policy.maxSingleExitMinutes != null
        ? String(data.policy.maxSingleExitMinutes)
        : ""
    );

    setMaxDailyExitMinutes(
      data.policy.maxDailyExitMinutes != null
        ? String(data.policy.maxDailyExitMinutes)
        : ""
    );

    setExitExceedAction(
      data.policy.exitExceedAction ?? ""
    );
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function saveCompany() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(`Save company failed (${res.status})`);
        return;
      }
      await load();
      setJustSaved(true);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function savePolicy() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          timezone,
          shiftStartMinute: hhmmToMinutes(start),
          shiftEndMinute: hhmmToMinutes(end),
          breakMinutes: Number(breakMin),
          lateGraceMinutes: Number(lateGrace),
          earlyLeaveGraceMinutes: Number(earlyGrace),

          breakAutoDeductEnabled,
          offDayEntryBehavior,
          leaveEntryBehavior,
          overtimeEnabled,
          workedCalculationMode,

          // Enterprise: Overtime dynamic break
          // "" => null (disable)
          otBreakInterval:
            otBreakInterval.trim() === ""
              ? null
              : (Number.isFinite(Number(otBreakInterval)) && Number(otBreakInterval) > 0
                  ? Number(otBreakInterval)
                  : null),
          otBreakDuration:
            otBreakDuration.trim() === ""
              ? null
              : (Number.isFinite(Number(otBreakDuration)) && Number(otBreakDuration) > 0
                  ? Number(otBreakDuration)
                  : null),

          // ✅ Advanced / Optional (boşsa gönderme)
          graceMode: graceAffectsWorked ? "PAID_PARTIAL" : "ROUND_ONLY",
          // IMPORTANT:
          // false/0 değerleri de persist edilebilsin diye undefined'a düşürmüyoruz.
          exitConsumesBreak,
          maxSingleExitMinutes: maxSingleExitMinutes === "" ? 0 : Number(maxSingleExitMinutes),
          maxDailyExitMinutes: maxDailyExitMinutes === "" ? 0 : Number(maxDailyExitMinutes),     
          exitExceedAction: exitExceedAction !== "" ? exitExceedAction : undefined,
        }),
      });
      if (!res.ok) {
        setError(`Save policy failed (${res.status})`);
        return;
      }
      await load();
      setJustSaved(true);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const dirtyCompany = useMemo(() => {
    if (!bundle) return false;
    return name !== (bundle.company?.name ?? "");
  }, [bundle, name]);
  const dirtyPolicy = useMemo(() => {
    if (!bundle) return false;
    const p = bundle.policy;
    const curStart = hhmmToMinutes(start);
    const curEnd = hhmmToMinutes(end);
   const curBreak = Number(breakMin);
    const curLate = Number(lateGrace);
    const curEarly = Number(earlyGrace);

    const curGraceMode = graceAffectsWorked ? "PAID_PARTIAL" : "ROUND_ONLY";
    const curMaxSingle = maxSingleExitMinutes === "" ? 0 : Number(maxSingleExitMinutes);
    const curMaxDaily = maxDailyExitMinutes === "" ? 0 : Number(maxDailyExitMinutes);
    const curExitExceedAction = exitExceedAction !== "" ? exitExceedAction : undefined;
    const curOtBreakInterval = otBreakInterval.trim() === "" ? null : Number(otBreakInterval);
    const curOtBreakDuration = otBreakDuration.trim() === "" ? null : Number(otBreakDuration);
    // API'den null gelebilir; UI'da boş değer undefined. Dirty hesapta eşitleyelim.
    const savedExitExceedAction = (p.exitExceedAction ?? undefined) as any;

   return (
      timezone !== (p.timezone ?? "") ||
      curStart !== (p.shiftStartMinute ?? 0) ||
      curEnd !== (p.shiftEndMinute ?? 0) ||
      curBreak !== (p.breakMinutes ?? 0) ||
      curLate !== (p.lateGraceMinutes ?? 0) ||
      curEarly !== (p.earlyLeaveGraceMinutes ?? 0) ||
      Boolean(breakAutoDeductEnabled) !== Boolean(p.breakAutoDeductEnabled) ||
      offDayEntryBehavior !== (p.offDayEntryBehavior ?? "IGNORE") ||
      (leaveEntryBehavior ?? "FLAG") !== (p.leaveEntryBehavior ?? "FLAG") ||
      Boolean(overtimeEnabled) !== Boolean(p.overtimeEnabled) ||
      (workedCalculationMode ?? "ACTUAL") !== ((p.workedCalculationMode ?? "ACTUAL") as any) ||
      (p.otBreakInterval ?? null) !== curOtBreakInterval ||
      (p.otBreakDuration ?? null) !== curOtBreakDuration ||
      curGraceMode !== (p.graceMode ?? "ROUND_ONLY") ||
      Boolean(exitConsumesBreak) !== Boolean(p.exitConsumesBreak) ||
      curMaxSingle !== (p.maxSingleExitMinutes ?? 0) ||
      curMaxDaily !== (p.maxDailyExitMinutes ?? 0) ||
      curExitExceedAction !== savedExitExceedAction
    );
  }, [
    bundle,
    timezone,
    start,
    end,
    breakMin,
    lateGrace,
    earlyGrace,
    breakAutoDeductEnabled,
    offDayEntryBehavior,
    leaveEntryBehavior,
    overtimeEnabled,
    workedCalculationMode,
    otBreakInterval,
    otBreakDuration,
    graceAffectsWorked,
    exitConsumesBreak,
    maxSingleExitMinutes,
    maxDailyExitMinutes,
    exitExceedAction,
  ]);

  const showSaveBar = dirtyCompany || dirtyPolicy;

  if (error) {
    return (
      <div className="grid gap-3">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-semibold">Hata</div>
          <div className="mt-1">{error}</div>
        </div>
        <button
          className="w-fit rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50"
          onClick={load}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        Yükleniyor...
      </div>
    );
  }

  // Vazgeç (Yenile): server'daki son kaydedilmiş haline dön
  async function revertToSaved() {
    setJustSaved(false);
    await load();
  }

  return (
    <div className="grid gap-4 pb-10">
      {/* Hero */}
     <div className={cx(DS.softCard, "p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-zinc-500">Ayarlar</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-zinc-900">Şirket &amp; Politika</div>
              <TonePill tone={showSaveBar ? "warn" : "good"}>
                {showSaveBar ? "Kaydedilmemiş değişiklik var" : "Kaydedildi"}
              </TonePill>
              <TonePill tone="neutral">TZ: {timezone}</TonePill>
              <TonePill tone="neutral">{name || bundle.company.name}</TonePill>
            </div>
            <div className="mt-2 max-w-3xl text-xs leading-5 text-zinc-600">
              Firma kimliği ve çalışma kuralları. Hesap motoru bu ayarları tek merkezden kullanır (tek kural kaynağı).
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              İpucu: Değişiklik yaptığınızda altta “Kaydedilmemiş değişiklikler” çubuğu görünür. Kaydetmeden çıkarsanız değerler korunmaz.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={saving}>
              Yenile
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (dirtyCompany) await saveCompany();
                if (dirtyPolicy) await savePolicy();
              }}
              disabled={!canSave || saving || !showSaveBar}
              title={!showSaveBar ? "Değişiklik yok" : "Hepsini Kaydet"}
            >
              {saving ? "Kaydediliyor..." : "Hepsini Kaydet"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ShortcutCard
            href="/policy/rule-sets"
            title="Kural Setleri"
            icon="🧩"
            tone="violet"
            desc={<>Çalışma kurallarını tanımlayın ve Workforce/Segment ile vardiya katmanlarında yönetin.</>}
            badge="POLICY"
          />
          <ShortcutCard
            href="/policy/shift-overrides"
            title="Vardiya Kural İstisnaları"
            icon="🌙"
            tone="warn"
            desc={<>Vardiya bazlı kural istisnası tanımlayın (Model-B). ShiftCode üzerinden kural seti bağlanır.</>}
            badge="SHIFT"
          />
          <ShortcutCard
            href="/org"
            title="Organizasyon"
            icon="🏢"
            tone="info"
            desc={<>Şube / Kapı / Cihaz envanteri. Kaynaklar ve görünürlük için tek yer.</>}
            badge="ORG"
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div className={cx("sticky top-4", DS.card, "p-3")}>
            <div className="text-[11px] font-semibold tracking-wide text-zinc-500">Hızlı Geçiş</div>
            <div className="mt-2 grid gap-2">
              <NavButton onClick={() => scrollTo(companyRef)} title="Company" desc="Firma adı ve temel kimlik" />
              <NavButton onClick={() => scrollTo(policyRef)} title="Policy" desc="Timezone, shift, grace, davranışlar" />
              <NavButton onClick={() => scrollTo(advancedRef)} title="Advanced" desc="Opsiyonel alanlar / limitler" />
           </div>
          </div>
        </aside>

        <main className="lg:col-span-9 grid gap-4">

      {/* Company */}
      <section
        ref={companyRef}
        className={cx(
          DS.card,
          "p-5",
          "bg-gradient-to-br from-sky-50/60 via-white to-white border-sky-200/60"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Company</h2>
            <div className="mt-1 text-xs text-zinc-500">Firma adı ve temel kimlik bilgisi.</div>
          </div>
          <Badge tone="info">ADMIN</Badge>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FieldShell label="Firma Adı">
            <input
              className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Turnike Demo"
            />
          </FieldShell>

          <div className="flex items-end justify-end">
            <Button variant="primary" disabled={!canSave || saving || !dirtyCompany} onClick={saveCompany} className="h-10 text-sm">
              {saving ? "Kaydediliyor..." : "Company Kaydet"}
            </Button>
          </div>
        </div>
      </section>

      {/* Policy */}
      <section ref={policyRef} className={cx(DS.card, "p-5", "bg-gradient-to-br from-violet-50/50 via-white to-white border-violet-200/60")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Company Policy</h2>
            <div className="mt-1 text-xs text-zinc-500">
              Vardiya, grace, break, izin (LEAVE) ve fazla mesai (OT) davranışları.
            </div>
          </div>
          <Badge tone="info">ADMIN/HR</Badge>
        </div>

        {/* Core */}
        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldShell
              label="Timezone"
              hint="Canonical work day bu timezone’a göre tekilleştirilir."
            >
              <input
                className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Istanbul"
              />
            </FieldShell>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-xs font-medium text-zinc-700">Gün Anahtarı (Canonical Work Day)</div>
              <div className="mt-1 text-xs text-zinc-600">
                Tüm UI/rapor/servis aynı gün anahtarını üretir. Timezone değişimi “bugün/dün kayması” gibi rapor eşleşmelerini etkiler.
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Öneri: Canlı sistemde timezone değişimini mesai dışı planlayın.
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Shift</div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell label="Shift Start">
                  <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </FieldShell>
                <FieldShell label="Shift End">
                  <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </FieldShell>
              </div>
              <FieldShell label="Break Minutes" hint="Otomatik break düşümü açıksa worked’dan düşer.">
                <input
                  className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                  type="number"
                  value={breakMin}
                  onChange={(e) => setBreakMin(Number(e.target.value))}
                />
              </FieldShell>
              <div className="text-[11px] text-zinc-500">
                Not: Break Auto Deduct kapalıysa, break dakikaları sadece raporlamada bilgi amaçlı kalır.
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Grace</div>
              <div className="text-[11px] text-zinc-500">
                Grace, geç kalma / erken çıkma toleransıdır. Anomali üretimini ve bazı modlarda worked hesabını etkileyebilir.
              </div>
              <div className="grid gap-4 xl:grid-cols-2 items-start">
                <FieldShell label="Late Grace Minutes">
                  <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    type="number"
                    value={lateGrace}
                    onChange={(e) => setLateGrace(Number(e.target.value))}
                  />
                </FieldShell>
                <FieldShell label="Early Leave Grace Minutes">
                  <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    type="number"
                    value={earlyGrace}
                    onChange={(e) => setEarlyGrace(Number(e.target.value))}
                  />
                </FieldShell>
              </div>
            </div>
          </div>

          {/* Behaviors */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Davranışlar</div>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Break Auto Deduct</div>
                    <div className="text-xs text-zinc-500">Açıksa, break süresi worked’dan otomatik düşülür.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={breakAutoDeductEnabled}
                    onChange={(e) => setBreakAutoDeductEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                <FieldShell
                  label="Off Day Entry Behavior"
                  hint="OFF: hafta sonu / resmi tatil gibi çalışılmayan gün (LEAVE değildir). OFF gününde punch gelirse ne olacak?"
                >
                  <select
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 overflow-hidden text-ellipsis whitespace-nowrap"
                    value={offDayEntryBehavior}
                    onChange={(e) => setOffDayEntryBehavior(e.target.value as any)}
                  >
                    <option value="IGNORE">IGNORE (yok say)</option>
                    <option value="FLAG">FLAG (göster + anomali üret)</option>
                    <option value="COUNT_AS_OT">COUNT_AS_OT (fazla mesaiye yaz)</option>
                  </select>
                </FieldShell>

                <FieldShell
                  label="Leave Entry Behavior"
                  hint="LEAVE: yıllık izin/rapor/mazeret (OFF ≠ LEAVE). İzin gününde punch gelirse ne olacak?"
                >
                  <select
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 overflow-hidden text-ellipsis whitespace-nowrap"
                    value={leaveEntryBehavior}
                    onChange={(e) => setLeaveEntryBehavior(e.target.value as any)}
                  >
                    <option value="IGNORE">IGNORE (çalışmayı yok say)</option>
                    <option value="FLAG">FLAG (çalışmayı göster + anomali)</option>
                    <option value="COUNT_AS_OT">COUNT_AS_OT (çalışmayı OT yaz)</option>
                  </select>
                </FieldShell>

                <InlineInfo
                  title="OFF ≠ LEAVE"
                  tone="warn"
                  desc={
                    <>
                      OFF: takvimsel tatil/hafta sonu. LEAVE: personel bazlı izin. Raporlama ve bordro için bu ayrım kritiktir.
                    </>
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Overtime</div>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Overtime Enabled</div>
                    <div className="text-xs text-zinc-500">Açıksa fazla mesai (OT) hesaplamaları devreye girer.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={overtimeEnabled}
                    onChange={(e) => setOvertimeEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">Worked Calculation Mode</div>
                      <div className="text-xs text-zinc-500">
                        ACTUAL: gerçek IN/OUT’a göre hesaplar. CLAMP: vardiya sınırlarına kırpar.
                      </div>
                    </div>
                  </div>
                  <select
                    className="mt-2 h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 overflow-hidden text-ellipsis whitespace-nowrap"
                    value={workedCalculationMode}
                    onChange={(e) => setWorkedCalculationMode(e.target.value as any)}
                  >
                    <option value="ACTUAL">ACTUAL (Gerçek giriş/çıkışa göre)</option>
                    <option value="CLAMP_TO_SHIFT">CLAMP_TO_SHIFT (Vardiya saatlerine kırp)</option>
                  </select>
                  <div className="mt-2 text-[11px] text-zinc-500">
                    İpucu: ACTUAL seçilirse erken giriş/geç çıkış worked’u artırabilir. CLAMP seçilirse vardiya dışı süreler kırpılır.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced */}
          <div ref={advancedRef} className="rounded-3xl border border-zinc-200 bg-white p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-semibold hover:bg-zinc-100"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <span>Advanced / Optional</span>
              <Badge tone={advancedOpen ? "warn" : "neutral"}>{advancedOpen ? "Açık" : "Kapalı"}</Badge>
            </button>

            {advancedOpen ? (
              <div className="mt-4 grid gap-4">
                <InlineInfo
                  title="Opsiyonel alanlar"
                  desc={
                    <>
                      Bu bölüm ileri seviye kısıtlar içindir. Değerler genellikle <span className="font-medium">0 = sınırsız</span> şeklinde çalışır.
                      Değişiklik yapmadan önce etkisini doğrulayın.
                    </>
                  }
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-sm font-semibold text-zinc-900">Grace Mode</div>
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">Grace affects worked</div>
                        <div className="text-xs text-zinc-500">
                          Açıksa grace süreleri worked’a “ücretli” olarak yansıyabilir.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={graceAffectsWorked}
                        onChange={(e) => setGraceAffectsWorked(e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-sm font-semibold text-zinc-900">Exit & Break</div>
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">Exit consumes break</div>
                        <div className="text-xs text-zinc-500">
                          Çıkış/pause sürelerini break’e sayar (break tüketimi).
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={exitConsumesBreak}
                        onChange={(e) => setExitConsumesBreak(e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell label="Max single exit minutes" hint="Tek bir çıkış/pause için üst limit. 0: sınırsız (mevcut davranış).">
                    <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                      type="number"
                      value={maxSingleExitMinutes}
                      onChange={(e) => setMaxSingleExitMinutes(e.target.value)}
                    />
                  </FieldShell>
                  <FieldShell label="Max daily exit minutes" hint="Gün toplam çıkış/pause için üst limit. 0: sınırsız (mevcut davranış).">
                    <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                      type="number"
                      value={maxDailyExitMinutes}
                      onChange={(e) => setMaxDailyExitMinutes(e.target.value)}
                    />
                  </FieldShell>
                </div>

                <FieldShell label="Exit exceed action" hint="Limit aşılırsa üretilecek davranış/anomali.">
                  <select
                    className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    value={exitExceedAction}
                    onChange={(e) => setExitExceedAction(e.target.value as any)}
                  >
                    <option value="">-- None --</option>
                    <option value="IGNORE">IGNORE (yok say)</option>
                    <option value="WARN">WARN (uyarı üret)</option>
                    <option value="FLAG">FLAG (anomali üret)</option>
                  </select>
                </FieldShell>
                {/* Enterprise: Overtime Dynamic Break */}
<div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
  <div className="flex flex-wrap items-start justify-between gap-2">
    <div>
      <div className="text-sm font-semibold text-zinc-900">Overtime Dynamic Break</div>
      <div className="mt-1 text-[11px] text-zinc-500">
        Fazla mesai dakikası hesaplandıktan sonra, tanımlı periyotlarda otomatik mola düşer.
        <span className="ml-1">(Örn: her 180 dk OT&apos;de 30 dk mola)</span>
      </div>
    </div>
    <span
      className={cx(
        "rounded-full border px-2.5 py-1 text-[11px]",
        overtimeEnabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-zinc-200 bg-zinc-50 text-zinc-600"
      )}
    >
      {overtimeEnabled ? "OT Açık" : "OT Kapalı"}
    </span>
  </div>

  <InlineInfo
    title="Nasıl çalışır?"
    desc={
      <>
        Formül: <span className="font-medium">OT -= floor(OT / Interval) × Duration</span>. Sonuç 0 altına düşmez.
        Boş bırakırsanız kural devre dışı kalır.
      </>
    }
  />

  <div className={cx("grid gap-4 md:grid-cols-2", !overtimeEnabled && "opacity-70")}>
    <FieldShell
      label="OT Break Interval (minutes)"
      hint="Kaç dakikalık fazla mesai sonunda bir mola tetiklensin? (boş: kapalı)"
    >
      <input
        className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
        type="number"
        min={0}
        inputMode="numeric"
        value={otBreakInterval}
        onChange={(e) => setOtBreakInterval(e.target.value)}
        placeholder="Örn: 180"
        disabled={!overtimeEnabled}
      />
    </FieldShell>

    <FieldShell
      label="OT Break Duration (minutes)"
      hint="Tetiklenen mola süresi kaç dakika? (boş: kapalı)"
    >
      <input
        className="h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
        type="number"
        min={0}
        inputMode="numeric"
        value={otBreakDuration}
        onChange={(e) => setOtBreakDuration(e.target.value)}
        placeholder="Örn: 30"
        disabled={!overtimeEnabled}
      />
    </FieldShell>
  </div>
</div>

              </div>
            ) : null}
          </div>
        </div>

        {/* Inline save (secondary) */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <div className="mr-auto text-[11px] text-zinc-500">
            Not: “Policy Kaydet” sadece policy alanlarında değişiklik varsa aktif olur.
          </div>
          <Button variant="primary" disabled={!canSave || saving || !dirtyPolicy} onClick={savePolicy} className="h-10 text-sm">
            {saving ? "Kaydediliyor..." : "Policy Kaydet"}
          </Button>
        </div>
      </section>

        </main>
      </div>

      {/* Sticky Save Bar */}
      <div
        className={cx(
          // Always visible on viewport when there are changes / just saved.
          "fixed bottom-4 left-0 right-0 z-40",
          (showSaveBar || justSaved) ? "" : "hidden"
        )}
      >
        <div className="pointer-events-none px-3">
          <div className="pointer-events-auto mx-auto w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white/90 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {showSaveBar ? (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  <div className="text-sm font-semibold text-zinc-900">Kaydedilmemiş değişiklikler</div>
                  <div className="text-xs text-zinc-500">
                    {dirtyCompany && dirtyPolicy ? "Firma + Policy" : dirtyCompany ? "Firma" : "Policy"}
                  </div>
                </>
              ) : (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <div className="text-sm font-semibold text-zinc-900">Kaydedildi</div>
                  <div className="text-xs text-zinc-500">Değişiklikler başarıyla kaydedildi.</div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showSaveBar ? (
                <>
                  <Button variant="secondary" onClick={revertToSaved} disabled={saving} className="h-10 text-sm">
                    Vazgeç (Yenile)
                  </Button>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      if (dirtyCompany) await saveCompany();
                      if (dirtyPolicy) await savePolicy();
                    }}
                    disabled={!canSave || saving}
                    className="h-10 text-sm"
                  >
                    {saving ? "Kaydediliyor..." : "Hepsini Kaydet"}
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setJustSaved(false)} className="h-10 text-sm">
                  Kapat
                </Button>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
