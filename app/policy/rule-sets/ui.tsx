"use client";

import { useEffect, useMemo, useState } from "react";

type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "violet";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    neutral: "bg-slate-100/90 text-slate-700 ring-slate-300/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    info: "bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(56,189,248,0.10))] text-sky-800 ring-sky-300/45 shadow-[0_8px_22px_rgba(14,165,233,0.12)]",
    good: "bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(52,211,153,0.10))] text-emerald-800 ring-emerald-300/45 shadow-[0_8px_22px_rgba(16,185,129,0.12)]",
    warn: "bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.10))] text-amber-900 ring-amber-300/45 shadow-[0_8px_22px_rgba(245,158,11,0.10)]",
    danger: "bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(251,113,133,0.10))] text-rose-800 ring-rose-300/45 shadow-[0_8px_22px_rgba(244,63,94,0.10)]",
    violet: "bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))] text-indigo-900 ring-indigo-300/45 shadow-[0_10px_24px_rgba(99,102,241,0.12)]",

  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function IconChip({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    neutral: "bg-slate-100/90 text-slate-700 ring-slate-300/55",
    info: "bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(56,189,248,0.10))] text-sky-800 ring-sky-300/45",
    good: "bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(52,211,153,0.10))] text-emerald-800 ring-emerald-300/45",
    warn: "bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.10))] text-amber-900 ring-amber-300/45",
    danger: "bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(251,113,133,0.10))] text-rose-800 ring-rose-300/45",
    violet: "bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))] text-indigo-900 ring-indigo-300/45",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
        map[tone],
        className
      )}
    >
      <span className="grid place-items-center rounded-full bg-white/70 ring-1 ring-inset ring-black/5 w-5 h-5">
        {icon}
      </span>
      <span>{children}</span>
    </span>
  );
}

function Card({
  tone = "neutral",
  title,
  subtitle,
  right,
  children,
  className,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const toneBg: Record<Tone, string> = {
    neutral: "border-slate-200/70 from-white via-slate-50/70 to-slate-100/60",
    info: "border-sky-200/60 from-white via-sky-50/65 to-cyan-50/55",
    good: "border-emerald-200/60 from-white via-emerald-50/65 to-teal-50/55",
    warn: "border-amber-200/65 from-white via-amber-50/70 to-orange-50/55",
    danger: "border-rose-200/65 from-white via-rose-50/65 to-pink-50/55",
    violet: "border-indigo-200/65 from-white via-indigo-50/70 to-violet-50/60",
  };

  return (
    <div
      className={cx(
        "rounded-2xl border bg-gradient-to-br p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)]",
        "hover:shadow-md transition-shadow",
        toneBg[tone],
        className
      )}
    >
      {(title || subtitle || right) ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <div className="text-sm font-semibold text-slate-950 leading-5">{title}</div>
            ) : null}
            {subtitle ? (
              <div className="mt-1 text-xs text-slate-600 leading-5">{subtitle}</div>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Button({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed";
  const map = {
    primary: "border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] hover:brightness-105",
    secondary: "border border-slate-200/80 bg-white/88 text-slate-900 hover:border-indigo-200 hover:bg-indigo-50/50 shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
    ghost: "bg-transparent text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-700 border border-transparent",
    danger: "border border-rose-300/30 bg-[linear-gradient(135deg,#e11d48,#f43f5e)] text-white shadow-[0_14px_28px_rgba(225,29,72,0.18)] hover:brightness-105",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

export default function PolicyRuleSetsClient({ canWrite }: { canWrite: boolean }) {
  const readOnly = !canWrite;

  const [items, setItems] = useState<Array<any>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<any>(null);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [saving, setSaving] = useState(false);

  // Full edit states
  const [name, setName] = useState("");
  const [breakMin, setBreakMin] = useState<number>(60);
  const [lateGrace, setLateGrace] = useState<number>(5);
  const [earlyGrace, setEarlyGrace] = useState<number>(5);

  const [breakAutoDeductEnabled, setBreakAutoDeductEnabled] = useState<boolean>(true);
  const [offDayEntryBehavior, setOffDayEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("IGNORE");
  const [leaveEntryBehavior, setLeaveEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("FLAG");
  const [overtimeEnabled, setOvertimeEnabled] = useState<boolean>(false);
  const [workedCalculationMode, setWorkedCalculationMode] = useState<"ACTUAL" | "CLAMP_TO_SHIFT">("ACTUAL");

  const [otBreakInterval, setOtBreakInterval] = useState<string>("");
  const [otBreakDuration, setOtBreakDuration] = useState<string>("");

  const [graceMode, setGraceMode] = useState<"ROUND_ONLY" | "PAID_PARTIAL">("ROUND_ONLY");
  const [exitConsumesBreak, setExitConsumesBreak] = useState<boolean>(false);
  const [maxSingleExitMinutes, setMaxSingleExitMinutes] = useState<string>("");
  const [maxDailyExitMinutes, setMaxDailyExitMinutes] = useState<string>("");
  const [ownershipNextShiftLookaheadMinutes, setOwnershipNextShiftLookaheadMinutes] = useState<string>("");
  const [exitExceedAction, setExitExceedAction] = useState<"" | "IGNORE" | "WARN" | "FLAG">("");

  async function loadList() {
    const res = await fetch("/api/policy/rule-sets", { credentials: "include" });
    const json = await res.json().catch(() => null);
    setItems(Array.isArray(json?.items) ? json.items : []);
  }

  async function loadDetail(id: string) {
    if (!id) return;
    const res = await fetch(`/api/policy/rule-sets/${id}`, { credentials: "include" });
    const json = await res.json().catch(() => null);
    const item = json?.item ?? null;
    setDetail(item);

    if (item) {
      setName(item.name ?? "");
      setBreakMin(Number(item.breakMinutes ?? 60));
      setLateGrace(Number(item.lateGraceMinutes ?? 5));
      setEarlyGrace(Number(item.earlyLeaveGraceMinutes ?? 5));

      setBreakAutoDeductEnabled(Boolean(item.breakAutoDeductEnabled));
      setOffDayEntryBehavior(item.offDayEntryBehavior ?? "IGNORE");
      setLeaveEntryBehavior(item.leaveEntryBehavior ?? "FLAG");
      setOvertimeEnabled(Boolean(item.overtimeEnabled));
      setWorkedCalculationMode((item.workedCalculationMode ?? "ACTUAL") as any);

      setOtBreakInterval(item.otBreakInterval != null ? String(item.otBreakInterval) : "");
      setOtBreakDuration(item.otBreakDuration != null ? String(item.otBreakDuration) : "");

      setGraceMode((item.graceMode ?? "ROUND_ONLY") as any);
      setExitConsumesBreak(Boolean(item.exitConsumesBreak));
      setMaxSingleExitMinutes(item.maxSingleExitMinutes != null ? String(item.maxSingleExitMinutes) : "");
      setMaxDailyExitMinutes(item.maxDailyExitMinutes != null ? String(item.maxDailyExitMinutes) : "");
      setOwnershipNextShiftLookaheadMinutes(
        item.ownershipNextShiftLookaheadMinutes != null ? String(item.ownershipNextShiftLookaheadMinutes) : ""
      );
      setExitExceedAction(item.exitExceedAction ?? "");
    }
  }

  const isSelectedDefault = useMemo(() => {
    const x = items.find((i) => i.id === selectedId);
    return x?.code === "DEFAULT";
  }, [items, selectedId]);

  // İstenilen davranış:
  // - Supervisor (readOnly) => her şey kilitli
  // - Admin (canWrite)     => DEFAULT dahil editlenebilir
  const isEditLocked = readOnly;

  async function createRuleSet() {
    if (readOnly) return; // 👈 supervisor guard
    if (!createCode.trim() || !createName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/policy/rule-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: createCode.trim(), name: createName.trim() }),
      });
      if (!res.ok) return;
      setCreateCode("");
      setCreateName("");
      await loadList();
    } finally {
      setSaving(false);
    }
  }

  async function patchDetail(patch: any) {
    if (readOnly) return; // 👈 supervisor guard
    if (!selectedId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/policy/rule-sets/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      await loadDetail(selectedId);
      await loadList();
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    if (!detail) return;
    if (isEditLocked) return; // 👈 supervisor guard

    const patch: any = {
      name,
      breakMinutes: Number(breakMin),
      lateGraceMinutes: Number(lateGrace),
      earlyLeaveGraceMinutes: Number(earlyGrace),

      breakAutoDeductEnabled,
      offDayEntryBehavior,
      leaveEntryBehavior,
      overtimeEnabled,
      workedCalculationMode,

      otBreakInterval:
        otBreakInterval.trim() === ""
          ? null
          : (Number.isFinite(Number(otBreakInterval)) && Number(otBreakInterval) > 0 ? Number(otBreakInterval) : null),
      otBreakDuration:
        otBreakDuration.trim() === ""
          ? null
          : (Number.isFinite(Number(otBreakDuration)) && Number(otBreakDuration) > 0 ? Number(otBreakDuration) : null),

      graceMode,
      exitConsumesBreak,
      maxSingleExitMinutes: maxSingleExitMinutes.trim() === "" ? null : Number(maxSingleExitMinutes),
      maxDailyExitMinutes: maxDailyExitMinutes.trim() === "" ? null : Number(maxDailyExitMinutes),
      ownershipNextShiftLookaheadMinutes:
        ownershipNextShiftLookaheadMinutes.trim() === "" ? null : Number(ownershipNextShiftLookaheadMinutes),

      exitExceedAction: exitExceedAction === "" ? null : exitExceedAction,
    };

    await patchDetail(patch);
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  const dirty = useMemo(() => {
    if (!detail) return false;

    const curOtBreakInterval = otBreakInterval.trim() === "" ? null : Number(otBreakInterval);
    const curOtBreakDuration = otBreakDuration.trim() === "" ? null : Number(otBreakDuration);
    const curMaxSingle = maxSingleExitMinutes.trim() === "" ? null : Number(maxSingleExitMinutes);
    const curMaxDaily = maxDailyExitMinutes.trim() === "" ? null : Number(maxDailyExitMinutes);
    const curOwnershipNextShiftLookahead = ownershipNextShiftLookaheadMinutes.trim() === "" ? null : Number(ownershipNextShiftLookaheadMinutes);
    const curExitExceedAction = exitExceedAction === "" ? null : exitExceedAction;

    return (
      name !== (detail.name ?? "") ||
      Number(breakMin) !== Number(detail.breakMinutes ?? 0) ||
      Number(lateGrace) !== Number(detail.lateGraceMinutes ?? 0) ||
      Number(earlyGrace) !== Number(detail.earlyLeaveGraceMinutes ?? 0) ||
      Boolean(breakAutoDeductEnabled) !== Boolean(detail.breakAutoDeductEnabled) ||
      offDayEntryBehavior !== (detail.offDayEntryBehavior ?? "IGNORE") ||
      leaveEntryBehavior !== (detail.leaveEntryBehavior ?? "FLAG") ||
      Boolean(overtimeEnabled) !== Boolean(detail.overtimeEnabled) ||
      (workedCalculationMode ?? "ACTUAL") !== (detail.workedCalculationMode ?? "ACTUAL") ||
      (detail.otBreakInterval ?? null) !== curOtBreakInterval ||
      (detail.otBreakDuration ?? null) !== curOtBreakDuration ||
      (graceMode ?? "ROUND_ONLY") !== (detail.graceMode ?? "ROUND_ONLY") ||
      Boolean(exitConsumesBreak) !== Boolean(detail.exitConsumesBreak) ||
      (detail.maxSingleExitMinutes ?? null) !== curMaxSingle ||
      (detail.maxDailyExitMinutes ?? null) !== curMaxDaily ||
      (detail.ownershipNextShiftLookaheadMinutes ?? null) !== curOwnershipNextShiftLookahead ||
      (detail.exitExceedAction ?? null) !== curExitExceedAction
    );
  }, [
    detail,
    name,
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
    graceMode,
    exitConsumesBreak,
    maxSingleExitMinutes,
    maxDailyExitMinutes,
    ownershipNextShiftLookaheadMinutes,
    exitExceedAction,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Kural Setleri</h1>

            {readOnly ? <Badge tone="warn">Read-only (Supervisor)</Badge> : null}

            {detail ? (
              <div className="flex items-center gap-2">
                {isSelectedDefault ? <Badge tone="violet">DEFAULT</Badge> : null}
                {!isSelectedDefault && dirty ? <Badge tone="warn">Kaydedilmedi</Badge> : null}
                {!isSelectedDefault && detail && !dirty ? <Badge tone="good">Güncel</Badge> : null}
              </div>
            ) : (
              <Badge tone="neutral">Seçim bekleniyor</Badge>
            )}
          </div>

          <p className="text-sm text-slate-600 leading-6">
            Kural seti (RuleSet), CompanyPolicy&apos;den <span className="font-medium text-slate-700">kopya (clone)</span> alınarak başlar.
            <span className="ml-1">Davranış kuralları kopyalanır; vardiya saatleri RuleSet içinde tutulmaz.</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IconChip tone="info" icon={<span className="text-[12px]">🧭</span>}>
            Timezone şirket seviyesinde (company-level) kalır
          </IconChip>
          <IconChip tone="violet" icon={<span className="text-[12px]">🧩</span>}>
            UI sadece gösterir (hesap yapmaz)
          </IconChip>
        </div>
      </div>

      <Card
        tone="info"
        title="Yeni Kural Seti Oluştur"
        subtitle="CompanyPolicy üzerinden kopyalanır. Kod benzersiz olmalı."
        right={<Badge tone="info">Clone</Badge>}
      >
        <div className="grid gap-2 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <div className="text-xs text-slate-600 mb-1">Kod</div>
            <input
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
              placeholder="Örn: WHITE"
              value={createCode}
              onChange={(e) => setCreateCode(e.target.value)}
              disabled={saving || readOnly}
            />
          </div>
          <div className="sm:col-span-7">
            <div className="text-xs text-slate-600 mb-1">Ad</div>
            <input
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
              placeholder="Örn: Beyaz Yaka Sabit"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              disabled={saving || readOnly}
            />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <Button
              className="w-full"
              variant="primary"
              disabled={saving || readOnly || !createCode.trim() || !createName.trim()}
              onClick={createRuleSet}
              title={readOnly ? "Read-only" : "Yeni kural seti oluştur"}
            >
              {saving ? "…" : "Oluştur"}
            </Button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-600">
          İpucu: Kod alanını kısa ve sabit tut (örn: <span className="font-medium">WHITE</span>, <span className="font-medium">BLUE</span>).
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card
          tone="violet"
          className="lg:col-span-4"
          title="Kural Seti Seçimi"
          subtitle="DEFAULT dahil tüm setler burada listelenir."
          right={<Badge tone="violet">{items.length} adet</Badge>}
        >
          <div className="space-y-2">
            <div className="text-xs text-slate-700 font-medium">Liste</div>
            <select
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Seç…</option>
              {items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </select>

            {!selectedId ? (
              <div className="mt-3 rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.94))] p-3 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                <div className="text-sm font-medium text-slate-950">Başlamak için bir set seç</div>
                <div className="mt-1 text-xs text-slate-600 leading-5">
                  Sağ tarafta detaylar ve ayarlar görünecek. DEFAULT seti salt okunurdur.
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card
          tone="neutral"
          className="lg:col-span-8"
          title="Kural Seti Detayı"
          subtitle="Seçilen kural setinin alanlarını düzenleyin ve kaydedin."
          right={
            detail ? (
              <div className="flex items-center gap-2">
                {detail?.code ? <Badge tone="neutral">{detail.code}</Badge> : null}
                {isSelectedDefault ? <Badge tone="violet">Salt okunur</Badge> : null}
                {readOnly ? <Badge tone="warn">Read-only</Badge> : null}
              </div>
            ) : null
          }
        >
          {!detail ? (
            <div className="rounded-2xl border border-dashed border-indigo-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(238,242,255,0.84))] p-6 text-center">
              <div className="text-base font-semibold text-slate-950">Detay görüntülenmiyor</div>
              <div className="mt-1 text-sm text-slate-600">
                Sol taraftan bir kural seti seçerek detayları açabilirsiniz.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm text-slate-900">
                  <span className="font-semibold">{detail.code}</span> — {detail.name}
                </div>
                {isSelectedDefault ? (
                  <Badge tone="violet">DEFAULT</Badge>
                ) : dirty ? (
                  <Badge tone="warn">Değişiklik var</Badge>
                ) : (
                  <Badge tone="good">Kaydedildi</Badge>
                )}
              </div>

              <div className="rounded-2xl border border-indigo-200/40 bg-gradient-to-br from-white via-indigo-50/65 to-violet-50/60 p-3 text-xs text-slate-700 leading-5 shadow-[0_10px_24px_rgba(99,102,241,0.06)]">
                <span className="font-medium">Not:</span> Kural seti, CompanyPolicy&apos;den kopya (clone) ile başlar.
                <span className="ml-1">Timezone şirket seviyesinde kalır; vardiya saatleri burada değil Shift katmanında yaşar.</span>
              </div>

              {/* Temel */}
              <div className="rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.94))] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="info">Temel</Badge>
                    <div className="text-sm font-semibold text-slate-950">Genel Kurallar</div>
                  </div>
                  {isEditLocked ? (
                    <div className="text-xs text-slate-600">
                      Supervisor (read-only)
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <div className="text-xs text-slate-600 mb-1">Ad</div>
                    <input
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={saving || isEditLocked}
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">Mola Süresi (dakika)</div>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={breakMin}
                      onChange={(e) => setBreakMin(Number(e.target.value || 0))}
                      disabled={saving || isEditLocked}
                      min={0}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">Geç Gelme Toleransı (dakika)</div>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={lateGrace}
                      onChange={(e) => setLateGrace(Number(e.target.value || 0))}
                      disabled={saving || isEditLocked}
                      min={0}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">Erken Çıkış Toleransı (dakika)</div>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={earlyGrace}
                      onChange={(e) => setEarlyGrace(Number(e.target.value || 0))}
                      disabled={saving || isEditLocked}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Davranış */}
              <div className="rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.94))] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                <div className="mb-3 flex items-center gap-2">
                  <Badge tone="violet">Davranış</Badge>
                  <div className="text-sm font-semibold text-slate-950">Kayıt & Hesap Modları</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">Mola Otomatik Düş (auto deduct)</div>
                    <select
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={breakAutoDeductEnabled ? "1" : "0"}
                      onChange={(e) => setBreakAutoDeductEnabled(e.target.value === "1")}
                      disabled={saving || isEditLocked}
                    >
                      <option value="1">Açık</option>
                      <option value="0">Kapalı</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">Fazla Mesai (OT) Aktif</div>
                    <select
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={overtimeEnabled ? "1" : "0"}
                      onChange={(e) => setOvertimeEnabled(e.target.value === "1")}
                      disabled={saving || isEditLocked}
                    >
                      <option value="1">Açık</option>
                      <option value="0">Kapalı</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">Çalışma Hesap Modu (Worked)</div>
                    <select
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={workedCalculationMode}
                      onChange={(e) => setWorkedCalculationMode(e.target.value as any)}
                      disabled={saving || isEditLocked}
                    >
                      <option value="ACTUAL">ACTUAL (gerçek)</option>
                      <option value="CLAMP_TO_SHIFT">CLAMP_TO_SHIFT (vardiyaya sıkıştır)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">OFF Gününde Kayıt Davranışı</div>
                    <select
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={offDayEntryBehavior}
                      onChange={(e) => setOffDayEntryBehavior(e.target.value as any)}
                      disabled={saving || isEditLocked}
                    >
                      <option value="IGNORE">IGNORE (yok say)</option>
                      <option value="FLAG">FLAG (işaretle)</option>
                      <option value="COUNT_AS_OT">COUNT_AS_OT (OT say)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">İzin Gününde Kayıt Davranışı</div>
                    <select
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={leaveEntryBehavior}
                      onChange={(e) => setLeaveEntryBehavior(e.target.value as any)}
                      disabled={saving || isEditLocked}
                    >
                      <option value="IGNORE">IGNORE (yok say)</option>
                      <option value="FLAG">FLAG (işaretle)</option>
                      <option value="COUNT_AS_OT">COUNT_AS_OT (OT say)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <div className="text-xs text-slate-600 mb-1">Tolerans Modu (Grace)</div>
                    <select
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={graceMode}
                      onChange={(e) => setGraceMode(e.target.value as any)}
                      disabled={saving || isEditLocked}
                    >
                      <option value="ROUND_ONLY">ROUND_ONLY (sadece yuvarla)</option>
                      <option value="PAID_PARTIAL">PAID_PARTIAL (kısmi ücret)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Fazla Mesai */}
              <div className="rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.94))] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                <div className="mb-3 flex items-center gap-2">
                  <Badge tone="warn">Fazla Mesai</Badge>
                  <div className="text-sm font-semibold text-slate-950">Dinamik Mola (OT Break)</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <div className="text-xs text-slate-600 mb-1">Mola Aralığı (dakika)</div>
                    <input
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={otBreakInterval}
                      onChange={(e) => setOtBreakInterval(e.target.value)}
                      disabled={saving || isEditLocked}
                      placeholder="Boş = kapalı"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <div className="text-xs text-slate-600 mb-1">Mola Süresi (dakika)</div>
                    <input
                      className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                      value={otBreakDuration}
                      onChange={(e) => setOtBreakDuration(e.target.value)}
                      disabled={saving || isEditLocked}
                      placeholder="Boş = kapalı"
                    />
                  </div>
                </div>
              </div>

              {/* Gelişmiş */}
              <div className="rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.94))] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                <div className="mb-3 flex items-center gap-2">
                  <Badge tone="danger">Gelişmiş</Badge>
                  <div className="text-sm font-semibold text-slate-950">İleri Seviye Kurallar</div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                    <div className="mb-3 flex items-center gap-2">
                      <Badge tone="danger">Exit</Badge>
                      <div className="text-sm font-semibold text-slate-950">Çıkış & Limit Davranışları</div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-12">
                        <div className="text-xs text-slate-600 mb-1">Çıkış Moladan Düşsün mü?</div>
                        <select
                          className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                          value={exitConsumesBreak ? "1" : "0"}
                          onChange={(e) => setExitConsumesBreak(e.target.value === "1")}
                          disabled={saving || isEditLocked}
                        >
                          <option value="0">Hayır</option>
                          <option value="1">Evet</option>
                        </select>
                      </div>

                      <div className="sm:col-span-6">
                        <div className="text-xs text-slate-600 mb-1">Tek Seferlik Çıkış Limiti (dk)</div>
                        <input
                          className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                          value={maxSingleExitMinutes}
                          onChange={(e) => setMaxSingleExitMinutes(e.target.value)}
                          disabled={saving || isEditLocked}
                          placeholder="Boş = sınırsız"
                        />
                      </div>

                      <div className="sm:col-span-6">
                        <div className="text-xs text-slate-600 mb-1">Günlük Toplam Çıkış Limiti (dk)</div>
                        <input
                          className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                          value={maxDailyExitMinutes}
                          onChange={(e) => setMaxDailyExitMinutes(e.target.value)}
                          disabled={saving || isEditLocked}
                          placeholder="Boş = sınırsız"
                        />
                      </div>

                      <div className="sm:col-span-12">
                        <div className="text-xs text-slate-600 mb-1">Limit Aşımı Aksiyonu</div>
                        <select
                          className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                          value={exitExceedAction}
                          onChange={(e) => setExitExceedAction(e.target.value as any)}
                          disabled={saving || isEditLocked}
                        >
                          <option value="">Yok</option>
                          <option value="IGNORE">IGNORE (yok say)</option>
                          <option value="WARN">WARN (uyar)</option>
                          <option value="FLAG">FLAG (işaretle)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-indigo-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(238,242,255,0.92))] p-4 shadow-[0_12px_28px_rgba(99,102,241,0.08)]">
                    <div className="mb-3 flex items-center gap-2">
                      <Badge tone="violet">Ownership</Badge>
                      <div className="text-sm font-semibold text-slate-950">Attendance Ownership</div>
                    </div>

                    <div className="grid gap-3">
                      <div>
                        <div className="text-xs text-slate-600 mb-1">Next Shift Lookahead (minutes)</div>
                        <input
                          className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-60"
                          value={ownershipNextShiftLookaheadMinutes}
                          onChange={(e) => setOwnershipNextShiftLookaheadMinutes(e.target.value)}
                          disabled={saving || isEditLocked}
                          placeholder="Boş = kapalı"
                          inputMode="numeric"
                        />
                        <div className="mt-1 text-[11px] text-slate-500 leading-5">
                          Sonraki vardiya başlangıcından önce kaç dakikalık pencerenin ownership kararında
                          güçlü aday sayılacağını belirler.
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 leading-5">
                          Bu ayar önceki vardiyayı uzatmaz. Yeni vardiyanın erken adaylığını güçlendirir.
                        </div>
                      </div>

                      <div className="rounded-2xl border border-indigo-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(238,242,255,0.84))] p-3 text-[11px] text-slate-600 leading-5 shadow-[0_10px_24px_rgba(99,102,241,0.06)]">
                        <div className="font-medium text-slate-900">Ownership notu</div>
                        <div className="mt-1">
                          Örnek: Sonraki vardiya 08:00 ve değer 60 ise, 07:00 itibarıyla gelen uygun
                          <span className="mx-1 font-medium">IN</span>
                          event&apos;leri sonraki vardiya için daha güçlü aday olur.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-end gap-2">
                  <Button
                    variant="secondary"
                    disabled={!detail}
                    onClick={() => loadDetail(selectedId)}
                    title="Detayı yeniden yükle"
                  >
                    Yenile
                  </Button>

                  <Button
                    variant="primary"
                    disabled={saving || isEditLocked || !dirty}
                    onClick={saveAll}
                    title={isEditLocked ? "Read-only" : "Tüm alanları kaydet"}
                  >
                    {saving ? "…" : dirty ? "Kaydet" : "Kaydedildi"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}