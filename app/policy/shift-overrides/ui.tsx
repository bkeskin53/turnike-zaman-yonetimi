"use client";

import { useEffect, useMemo, useState } from "react";

type ShiftTemplate = { id: string; shiftCode: string; signature: string; startTime: string; endTime: string; spansMidnight: boolean; isActive: boolean };
type RuleSet = { id: string; code: string; name: string };

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
            {title ? <div className="text-sm font-semibold text-zinc-900 leading-5">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-xs text-zinc-600 leading-5">{subtitle}</div> : null}
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed";
  const map = {
    primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 border border-indigo-600/20",
    secondary: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 shadow-sm",
    ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100 border border-transparent",
    danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 border border-rose-600/20",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-sm shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500";


function fmtShiftLabel(t: ShiftTemplate) {
  const sig = t.signature ?? "";
  const code = t.shiftCode ?? "";
  if (code && code !== sig) return `${code} (${sig})`;
  return code || sig || "—";
}

function formatScopeTR(scope: string) {
  switch (scope) {
    case "SHIFT":
      return "Vardiya (Genel)";
    case "BRANCH_SHIFT":
      return "Şube + Vardiya";
    case "EMPLOYEE_GROUP_SHIFT":
      return "Grup + Vardiya";
    case "EMPLOYEE_SUBGROUP_SHIFT":
      return "Alt Grup + Vardiya";
    case "EMPLOYEE_SHIFT":
      return "Personel + Vardiya";
    default:
      return scope;
  }
}

export default function ShiftOverridesPage({ canWrite }: { canWrite: boolean }) {
  const readOnly = !canWrite;
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filterShiftCode, setFilterShiftCode] = useState<string>("");

  const [scope, setScope] = useState<string>("SHIFT");
  const [shiftCode, setShiftCode] = useState<string>("");
  const [ruleSetId, setRuleSetId] = useState<string>("");
  const [priority, setPriority] = useState<number>(100);
  const [validFromDayKey, setValidFromDayKey] = useState<string>("");
  const [validToDayKey, setValidToDayKey] = useState<string>("");

  const [employeeId, setEmployeeId] = useState<string>("");
  const [employeeGroupId, setEmployeeGroupId] = useState<string>("");
  const [employeeSubgroupId, setEmployeeSubgroupId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");

  const scopeNeedsTarget = useMemo(() => {
    return scope !== "SHIFT";
  }, [scope]);

  async function loadAll() {
    setLoading(true);
    try {
      const [stRes, rsRes, itRes] = await Promise.all([
        fetch("/api/shift-templates?includeInactive=1", { credentials: "include" }),
        fetch("/api/policy/rule-sets", { credentials: "include" }),
        fetch("/api/policy/shift-assignments", { credentials: "include" }),
      ]);
      const stJson = await stRes.json();
      const rsJson = await rsRes.json();
      const itJson = await itRes.json();

      setShiftTemplates(Array.isArray(stJson.items) ? stJson.items : []);
      setRuleSets(Array.isArray(rsJson.items) ? rsJson.items : []);
      setItems(Array.isArray(itJson.items) ? itJson.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredItems = useMemo(() => {
    const code = filterShiftCode.trim();
    if (!code) return items;
    return items.filter((x) => String(x.shiftCode ?? "") === code);
  }, [items, filterShiftCode]);

  async function create() {
    if (readOnly) return; // supervisor guard
    setSaving(true);
    try {
      const body: any = {
        scope,
        shiftCode,
        ruleSetId,
        priority,
        validFromDayKey: validFromDayKey.trim() || null,
        validToDayKey: validToDayKey.trim() || null,
      };
      if (scope === "EMPLOYEE_SHIFT") body.employeeId = employeeId || null;
      if (scope === "EMPLOYEE_GROUP_SHIFT") body.employeeGroupId = employeeGroupId || null;
      if (scope === "EMPLOYEE_SUBGROUP_SHIFT") body.employeeSubgroupId = employeeSubgroupId || null;
      if (scope === "BRANCH_SHIFT") body.branchId = branchId || null;

      const res = await fetch("/api/policy/shift-assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json?.error ?? "SAVE_FAILED"));
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (readOnly) return; // supervisor guard
    if (!id) return;
    const res = await fetch("/api/policy/shift-assignments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(String(json?.error ?? "DELETE_FAILED"));
    await loadAll();
  }

  return (
    <div className="grid gap-4">
      <Card
        tone="info"
        title="Vardiya İstisna Kuralları (Shift Override)"
        subtitle="Belirli bir vardiya için, seçtiğiniz kapsamda (şube/grup/personel) farklı bir kural seti uygulamak içindir."
        right={
          <div className="flex items-center gap-2">
            {readOnly ? <Badge tone="warn">Read-only (Supervisor)</Badge> : null}
            <Badge tone="info">Kılavuz</Badge>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <IconChip tone="info" icon={<span className="text-[12px]">🧠</span>}>
            Vardiya gününde önce buradaki eşleşmeler aranır
          </IconChip>
          <IconChip tone="violet" icon={<span className="text-[12px]">🧩</span>}>
            Bulunamazsa standart (base) kurallar çalışır
          </IconChip>
          <IconChip tone="warn" icon={<span className="text-[12px]">🎛️</span>}>
            Öncelik (priority): çakışmada hangi kaydın seçileceği
          </IconChip>
          <IconChip tone="neutral" icon={<span className="text-[12px]">📅</span>}>
            Geçerlilik (valid): tarih aralığı (boş = sınırsız)
          </IconChip>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <div className="text-xs font-semibold text-zinc-700">Filtre: Vardiya</div>
            <select
              className={cx("mt-1", inputClass)}
              value={filterShiftCode}
              onChange={(e) => setFilterShiftCode(e.target.value)}
              disabled={loading}
            >
              <option value="">(Hepsi)</option>
              {shiftTemplates
                .slice()
                .sort((a, b) => fmtShiftLabel(a).localeCompare(fmtShiftLabel(b)))
                .map((t) => (
                  <option key={t.id} value={t.shiftCode}>
                    {fmtShiftLabel(t)}
                  </option>
                ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <Button className="w-full" variant="secondary" onClick={loadAll} disabled={loading}>
              {loading ? "Yükleniyor…" : "Yenile"}
            </Button>
          </div>
        </div>
        <div className="mt-1 text-[11px] text-zinc-600">
          İpucu: Listede sadece seçtiğiniz vardiya kodu görünür.
        </div>
      </Card>

      <Card
        tone="violet"
        title="Yeni İstisna Kuralı Oluştur"
        subtitle="Bir vardiya + bir kural seti seçin. İsteğe bağlı olarak kapsam ve tarih aralığı belirleyin."
        right={<Badge tone="violet">Oluştur</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-zinc-700">Kapsam (scope)</div>
            <select className={cx("mt-1", inputClass)} value={scope} onChange={(e) => setScope(e.target.value)} disabled={saving || readOnly}>
              <option value="SHIFT">Vardiya (Genel)</option>
              <option value="BRANCH_SHIFT">Şube + Vardiya</option>
              <option value="EMPLOYEE_GROUP_SHIFT">Grup + Vardiya</option>
              <option value="EMPLOYEE_SUBGROUP_SHIFT">Alt Grup + Vardiya</option>
              <option value="EMPLOYEE_SHIFT">Personel + Vardiya</option>
            </select>
            <div className="mt-1 text-[11px] text-zinc-600">
              Teknik: scope (kapsam) seçimi, kaydın hangi hedefe bağlanacağını belirler.
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-zinc-700">Vardiya</div>
            <select className={cx("mt-1", inputClass)} value={shiftCode} onChange={(e) => setShiftCode(e.target.value)} disabled={saving || readOnly}>
              <option value="">(seç)</option>
              {shiftTemplates
                .slice()
                .sort((a, b) => fmtShiftLabel(a).localeCompare(fmtShiftLabel(b)))
                .map((t) => (
                 <option key={t.id} value={t.shiftCode}>
                    {fmtShiftLabel(t)}
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-zinc-700">Kural Seti (RuleSet)</div>
           <select className={cx("mt-1", inputClass)} value={ruleSetId} onChange={(e) => setRuleSetId(e.target.value)} disabled={saving || readOnly}>
              <option value="">(seç)</option>
              {ruleSets
                .slice()
                .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
                .map((rs) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.code} — {rs.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-700">Öncelik (priority)</div>
            <input
              className={cx("mt-1", inputClass)}
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              disabled={saving || readOnly}
            />
            <div className="mt-1 text-[11px] text-zinc-600">
              Çakışma durumunda hangi kaydın seçileceğini etkiler.
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-700">Geçerlilik Başlangıç</div>
            <input
              className={cx("mt-1", inputClass)}
              placeholder="YYYY-AA-GG"
              value={validFromDayKey}
              onChange={(e) => setValidFromDayKey(e.target.value)}
              disabled={saving || readOnly}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-700">Geçerlilik Bitiş</div>
            <input
              className={cx("mt-1", inputClass)}
              placeholder="YYYY-AA-GG"
              value={validToDayKey}
              onChange={(e) => setValidToDayKey(e.target.value)}
              disabled={saving || readOnly}
            />
          </div>

          {scopeNeedsTarget && (
            <div className="md:col-span-6">
              <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-b from-zinc-50 to-white p-3 text-sm text-zinc-700">
                Bu ekranda hedef seçimlerini şimdilik <b>ID</b> ile alıyoruz. Kurumsal sürümde bu alanlar arama + seçim
                (picker) ile kolaylaşacak.
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {scope === "EMPLOYEE_SHIFT" && (
                  <div>
                    <div className="text-xs font-semibold text-zinc-700">Personel ID</div>
                    <input
                      className={cx("mt-1", inputClass)}
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      disabled={saving || readOnly}
                    />
                  </div>
                )}
                {scope === "EMPLOYEE_GROUP_SHIFT" && (
                  <div>
                    <div className="text-xs font-semibold text-zinc-700">Grup ID</div>
                    <input
                      className={cx("mt-1", inputClass)}
                      value={employeeGroupId}
                      onChange={(e) => setEmployeeGroupId(e.target.value)}
                      disabled={saving || readOnly}
                    />
                  </div>
                )}
                {scope === "EMPLOYEE_SUBGROUP_SHIFT" && (
                  <div>
                    <div className="text-xs font-semibold text-zinc-700">Alt Grup ID</div>
                    <input
                      className={cx("mt-1", inputClass)}
                      value={employeeSubgroupId}
                      onChange={(e) => setEmployeeSubgroupId(e.target.value)}
                      disabled={saving || readOnly}
                    />
                  </div>
                )}
                {scope === "BRANCH_SHIFT" && (
                  <div>
                    <div className="text-xs font-semibold text-zinc-700">Şube ID</div>
                    <input
                      className={cx("mt-1", inputClass)}
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      disabled={saving || readOnly}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="md:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-zinc-600">
                Zorunlu alanlar: <span className="font-medium text-zinc-700">Vardiya</span> ve{" "}
                <span className="font-medium text-zinc-700">Kural Seti</span>
              </div>
              <Button
                variant="primary"
                onClick={create}
                disabled={saving || readOnly || !shiftCode || !ruleSetId || !scope}
                title="İstisna kuralını kaydet"
              >
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card
        tone="neutral"
        title="Mevcut İstisna Kuralları"
        subtitle="Kayıtları listeler. İsterseniz silerek geri alabilirsiniz."
        right={<Badge tone="neutral">{filteredItems.length} kayıt</Badge>}
      >
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                <th className="border-b border-zinc-200 px-2 py-2">Vardiya</th>
                <th className="border-b border-zinc-200 px-2 py-2">Kapsam</th>
                <th className="border-b border-zinc-200 px-2 py-2">Hedef</th>
                <th className="border-b border-zinc-200 px-2 py-2">Kural Seti</th>
                <th className="border-b border-zinc-200 px-2 py-2 text-right">Öncelik</th>
                <th className="border-b border-zinc-200 px-2 py-2">Geçerlilik</th>
                <th className="border-b border-zinc-200 px-2 py-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => {
                const target =
                  it.employee?.employeeCode
                    ? `${it.employee.employeeCode} (${it.employee.firstName ?? ""} ${it.employee.lastName ?? ""})`
                    : it.employeeSubgroup?.code
                    ? `${it.employeeSubgroup.code}`
                    : it.employeeGroup?.code
                    ? `${it.employeeGroup.code}`
                    : it.branch?.name
                    ? `${it.branch.name}`
                    : "—";
                const rs = it.ruleSet ? `${it.ruleSet.code} — ${it.ruleSet.name}` : "—";
                const valid = `${it.validFrom ? String(it.validFrom).slice(0, 10) : "—"} → ${
                  it.validTo ? String(it.validTo).slice(0, 10) : "—"
                }`;
                return (
                  <tr key={it.id} className="hover:bg-zinc-50/80">
                    <td className="px-2 py-2 font-medium text-zinc-900">{it.shiftCode}</td>
                    <td className="px-2 py-2">
                      <Badge tone="violet" className="align-middle">
                        {formatScopeTR(String(it.scope))}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-zinc-800">{target}</td>
                    <td className="px-2 py-2 text-zinc-800">{rs}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{it.priority ?? 100}</td>
                    <td className="px-2 py-2 text-zinc-700">{valid}</td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => remove(it.id)}
                        disabled={readOnly}
                        title={readOnly ? "Read-only" : "Sil"}
                      >
                        Sil
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-zinc-600" colSpan={7}>
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}