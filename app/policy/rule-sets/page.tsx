"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/app/_components/AppShellNoSSR";

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
    neutral: "bg-zinc-100 text-zinc-800 ring-zinc-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
    good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    danger: "bg-rose-50 text-rose-800 ring-rose-200",
    violet: "bg-violet-50 text-violet-800 ring-violet-200",
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
    neutral: "bg-zinc-100 text-zinc-800 ring-zinc-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
    good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    danger: "bg-rose-50 text-rose-800 ring-rose-200",
    violet: "bg-violet-50 text-violet-800 ring-violet-200",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
        map[tone],
        className
      )}
    >
      <span className="grid place-items-center rounded-full bg-white/60 ring-1 ring-inset ring-black/5 w-5 h-5">
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
    neutral: "from-zinc-50 to-white",
    info: "from-sky-50 to-white",
    good: "from-emerald-50 to-white",
    warn: "from-amber-50 to-white",
    danger: "from-rose-50 to-white",
    violet: "from-violet-50 to-white",
  };

  return (
    <div
      className={cx(
        "rounded-2xl border border-zinc-200/70 bg-gradient-to-b p-4 shadow-sm",
        "hover:shadow-md transition-shadow",
        toneBg[tone],
        className
      )}
    >
      {(title || subtitle || right) ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <div className="text-sm font-semibold text-zinc-900 leading-5">{title}</div>
            ) : null}
            {subtitle ? (
              <div className="mt-1 text-xs text-zinc-600 leading-5">{subtitle}</div>
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
    primary:
      "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 border border-indigo-600/20",
    secondary:
      "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 shadow-sm",
    ghost:
      "bg-transparent text-zinc-700 hover:bg-zinc-100 border border-transparent",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

function minutesToHHMM(m: number) {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

function hhmmToMinutes(s: string) {
  const [h, m] = String(s ?? "").split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export default function PolicyRuleSetsPage() {
  const [items, setItems] = useState<Array<any>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<any>(null);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [saving, setSaving] = useState(false);

  // Full edit states (CompanyPolicy UI ile aynı mantık)
  const [name, setName] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [breakMin, setBreakMin] = useState<number>(60);
  const [lateGrace, setLateGrace] = useState<number>(5);
  const [earlyGrace, setEarlyGrace] = useState<number>(5);

  const [breakAutoDeductEnabled, setBreakAutoDeductEnabled] = useState<boolean>(true);
  const [offDayEntryBehavior, setOffDayEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("IGNORE");
  const [leaveEntryBehavior, setLeaveEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("FLAG");
  const [overtimeEnabled, setOvertimeEnabled] = useState<boolean>(false);
  const [workedCalculationMode, setWorkedCalculationMode] = useState<"ACTUAL" | "CLAMP_TO_SHIFT">("ACTUAL");

  // Enterprise OT dynamic break
  const [otBreakInterval, setOtBreakInterval] = useState<string>("");
  const [otBreakDuration, setOtBreakDuration] = useState<string>("");

  // Advanced / Optional
  const [graceMode, setGraceMode] = useState<"ROUND_ONLY" | "PAID_PARTIAL">("ROUND_ONLY");
  const [exitConsumesBreak, setExitConsumesBreak] = useState<boolean>(false);
  const [maxSingleExitMinutes, setMaxSingleExitMinutes] = useState<string>("");
  const [maxDailyExitMinutes, setMaxDailyExitMinutes] = useState<string>("");
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
      setStart(minutesToHHMM(Number(item.shiftStartMinute ?? 540)));
      setEnd(minutesToHHMM(Number(item.shiftEndMinute ?? 1080)));
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
      setExitExceedAction(item.exitExceedAction ?? "");
    }
  }

  async function createRuleSet() {
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
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/policy/rule-sets/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return;
      // refresh full detail after save (source of truth)
      await loadDetail(selectedId);
      await loadList();
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    if (!detail) return;
    const patch: any = {
      name,
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

  const isSelectedDefault = useMemo(() => {
    const x = items.find((i) => i.id === selectedId);
    return x?.code === "DEFAULT";
  }, [items, selectedId]);

  const dirty = useMemo(() => {
    if (!detail) return false;
    const curStart = hhmmToMinutes(start);
    const curEnd = hhmmToMinutes(end);
    const curOtBreakInterval = otBreakInterval.trim() === "" ? null : Number(otBreakInterval);
    const curOtBreakDuration = otBreakDuration.trim() === "" ? null : Number(otBreakDuration);
    const curMaxSingle = maxSingleExitMinutes.trim() === "" ? null : Number(maxSingleExitMinutes);
    const curMaxDaily = maxDailyExitMinutes.trim() === "" ? null : Number(maxDailyExitMinutes);
    const curExitExceedAction = exitExceedAction === "" ? null : exitExceedAction;

    return (
      name !== (detail.name ?? "") ||
      curStart !== Number(detail.shiftStartMinute ?? 0) ||
      curEnd !== Number(detail.shiftEndMinute ?? 0) ||
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
      (detail.exitExceedAction ?? null) !== curExitExceedAction
    );
  }, [
    detail,
    name,
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
    graceMode,
    exitConsumesBreak,
    maxSingleExitMinutes,
    maxDailyExitMinutes,
    exitExceedAction,
  ]);

  return (
    <AppShell
      title="Policy"
      subtitle="Kural setleri ve vardiya istisna kuralları"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Kural Setleri</h1>
              {detail ? (
                <div className="flex items-center gap-2">
                  {isSelectedDefault ? <Badge tone="violet">DEFAULT • Salt okunur</Badge> : null}
                  {!isSelectedDefault && dirty ? <Badge tone="warn">Kaydedilmedi</Badge> : null}
                  {!isSelectedDefault && detail && !dirty ? <Badge tone="good">Güncel</Badge> : null}
                </div>
              ) : (
                <Badge tone="neutral">Seçim bekleniyor</Badge>
              )}
            </div>
            <p className="text-sm text-zinc-600 leading-6">
              Kural seti (RuleSet), CompanyPolicy&apos;den <span className="font-medium text-zinc-700">kopya (clone)</span> alınarak başlar.
              <span className="ml-1">DEFAULT silinmez/yenilenmez; sadece referanstır.</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <IconChip
              tone="info"
              icon={<span className="text-[12px]">🧭</span>}
            >
              Timezone şirket seviyesinde (company-level) kalır
            </IconChip>
            <IconChip
              tone="violet"
              icon={<span className="text-[12px]">🧩</span>}
            >
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
              <div className="text-xs text-zinc-600 mb-1">Kod</div>
              <input
                className="w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Örn: WHITE"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
              />
            </div>
            <div className="sm:col-span-7">
              <div className="text-xs text-zinc-600 mb-1">Ad</div>
              <input
                className="w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Örn: Beyaz Yaka Sabit"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <Button
                className="w-full"
                variant="primary"
                disabled={saving}
                onClick={createRuleSet}
                title="Yeni kural seti oluştur"
              >
                {saving ? "…" : "Oluştur"}
              </Button>
            </div>
          </div>
          <div className="mt-3 text-xs text-zinc-600">
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
              <div className="text-xs text-zinc-700 font-medium">Liste</div>
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <div className="mt-3 rounded-2xl border border-zinc-200/70 bg-white/70 p-3">
                  <div className="text-sm font-medium text-zinc-900">Başlamak için bir set seç</div>
                  <div className="mt-1 text-xs text-zinc-600 leading-5">
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
                </div>
              ) : null
            }
          >
            {!detail ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-6 text-center">
                <div className="text-base font-semibold text-zinc-900">Detay görüntülenmiyor</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Sol taraftan bir kural seti seçerek detayları açabilirsiniz.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm text-zinc-900">
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

                <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-b from-zinc-50 to-white p-3 text-xs text-zinc-700 leading-5">
                  <span className="font-medium">Not:</span> Kural seti, CompanyPolicy&apos;den kopya (clone) ile başlar.
                  <span className="ml-1">Timezone şirket seviyesinde kalır; burada değişmez.</span>
                </div>

                {/* Temel */}
                <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">Temel</Badge>
                      <div className="text-sm font-semibold text-zinc-900">Genel & Vardiya Penceresi</div>
                    </div>
                    {isSelectedDefault ? (
                      <div className="text-xs text-zinc-600">DEFAULT düzenlenemez</div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-6">
                      <div className="text-xs text-zinc-600 mb-1">Ad</div>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSelectedDefault}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <div className="text-xs text-zinc-600 mb-1">Vardiya Başlangıç</div>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        disabled={isSelectedDefault}
                        placeholder="09:00"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <div className="text-xs text-zinc-600 mb-1">Vardiya Bitiş</div>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        disabled={isSelectedDefault}
                        placeholder="18:00"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Mola Süresi (dakika)</div>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={breakMin}
                        onChange={(e) => setBreakMin(Number(e.target.value || 0))}
                        disabled={isSelectedDefault}
                        min={0}
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Geç Gelme Toleransı (dakika)</div>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={lateGrace}
                        onChange={(e) => setLateGrace(Number(e.target.value || 0))}
                        disabled={isSelectedDefault}
                        min={0}
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Erken Çıkış Toleransı (dakika)</div>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={earlyGrace}
                        onChange={(e) => setEarlyGrace(Number(e.target.value || 0))}
                        disabled={isSelectedDefault}
                        min={0}
                      />
                    </div>
                  </div>
                </div>

                {/* Davranış */}
                <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone="violet">Davranış</Badge>
                    <div className="text-sm font-semibold text-zinc-900">Kayıt & Hesap Modları</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Mola Otomatik Düş (auto deduct)</div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={breakAutoDeductEnabled ? "1" : "0"}
                        onChange={(e) => setBreakAutoDeductEnabled(e.target.value === "1")}
                        disabled={isSelectedDefault}
                      >
                        <option value="1">Açık</option>
                        <option value="0">Kapalı</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Fazla Mesai (OT) Aktif</div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={overtimeEnabled ? "1" : "0"}
                        onChange={(e) => setOvertimeEnabled(e.target.value === "1")}
                        disabled={isSelectedDefault}
                      >
                        <option value="1">Açık</option>
                        <option value="0">Kapalı</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Çalışma Hesap Modu (Worked)</div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={workedCalculationMode}
                        onChange={(e) => setWorkedCalculationMode(e.target.value as any)}
                        disabled={isSelectedDefault}
                      >
                        <option value="ACTUAL">ACTUAL (gerçek)</option>
                        <option value="CLAMP_TO_SHIFT">CLAMP_TO_SHIFT (vardiyaya sıkıştır)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">OFF Gününde Kayıt Davranışı</div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={offDayEntryBehavior}
                        onChange={(e) => setOffDayEntryBehavior(e.target.value as any)}
                        disabled={isSelectedDefault}
                      >
                        <option value="IGNORE">IGNORE (yok say)</option>
                        <option value="FLAG">FLAG (işaretle)</option>
                        <option value="COUNT_AS_OT">COUNT_AS_OT (OT say)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">İzin Gününde Kayıt Davranışı</div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={leaveEntryBehavior}
                        onChange={(e) => setLeaveEntryBehavior(e.target.value as any)}
                        disabled={isSelectedDefault}
                      >
                        <option value="IGNORE">IGNORE (yok say)</option>
                        <option value="FLAG">FLAG (işaretle)</option>
                        <option value="COUNT_AS_OT">COUNT_AS_OT (OT say)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Tolerans Modu (Grace)</div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={graceMode}
                        onChange={(e) => setGraceMode(e.target.value as any)}
                        disabled={isSelectedDefault}
                      >
                        <option value="ROUND_ONLY">ROUND_ONLY (sadece yuvarla)</option>
                        <option value="PAID_PARTIAL">PAID_PARTIAL (kısmi ücret)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Fazla Mesai */}
                <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone="warn">Fazla Mesai</Badge>
                    <div className="text-sm font-semibold text-zinc-900">Dinamik Mola (OT Break)</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-6">
                      <div className="text-xs text-zinc-600 mb-1">Mola Aralığı (dakika)</div>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={otBreakInterval}
                        onChange={(e) => setOtBreakInterval(e.target.value)}
                        disabled={isSelectedDefault}
                        placeholder="Boş = kapalı"
                      />
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Örn: 120 → her 120 dakikada bir mola hakkı.
                      </div>
                    </div>
                    <div className="sm:col-span-6">
                      <div className="text-xs text-zinc-600 mb-1">Mola Süresi (dakika)</div>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={otBreakDuration}
                        onChange={(e) => setOtBreakDuration(e.target.value)}
                        disabled={isSelectedDefault}
                        placeholder="Boş = kapalı"
                      />
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Örn: 15 → hak edilen mola başına 15 dk düşülür.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gelişmiş */}
                <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone="danger">Gelişmiş</Badge>
                    <div className="text-sm font-semibold text-zinc-900">Çıkış & Limit Davranışları</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Çıkış Moladan Düşsün mü?</div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={exitConsumesBreak ? "1" : "0"}
                        onChange={(e) => setExitConsumesBreak(e.target.value === "1")}
                        disabled={isSelectedDefault}
                      >
                        <option value="0">Hayır</option>
                        <option value="1">Evet</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Tek Seferlik Çıkış Limiti (dk)</div>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={maxSingleExitMinutes}
                        onChange={(e) => setMaxSingleExitMinutes(e.target.value)}
                        disabled={isSelectedDefault}
                        placeholder="Boş = sınırsız"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Günlük Toplam Çıkış Limiti (dk)</div>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={maxDailyExitMinutes}
                        onChange={(e) => setMaxDailyExitMinutes(e.target.value)}
                        disabled={isSelectedDefault}
                        placeholder="Boş = sınırsız"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-6">
                      <div className="text-xs text-zinc-600 mb-1">Limit Aşımı Aksiyonu</div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={exitExceedAction}
                        onChange={(e) => setExitExceedAction(e.target.value as any)}
                        disabled={isSelectedDefault}
                      >
                        <option value="">Yok</option>
                        <option value="IGNORE">IGNORE (yok say)</option>
                        <option value="WARN">WARN (uyar)</option>
                        <option value="FLAG">FLAG (işaretle)</option>
                      </select>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Teknik: action (aksiyon) seçimi motor tarafından değerlendirilir; UI sadece ayarı kaydeder.
                      </div>
                    </div>
                    <div className="sm:col-span-6 flex items-end justify-end gap-2">
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
                        disabled={saving || isSelectedDefault || !dirty}
                        onClick={saveAll}
                        title={isSelectedDefault ? "DEFAULT salt okunur" : "Tüm alanları kaydet"}
                      >
                        {saving ? "…" : dirty ? "Kaydet" : "Kaydedildi"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}