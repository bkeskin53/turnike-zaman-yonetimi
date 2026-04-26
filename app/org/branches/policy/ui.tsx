"use client";

import { useEffect, useMemo, useState } from "react";
import { OrgSubNav } from "@/app/org/_components/OrgSubNav";

export default function BranchPolicyClient(props: { canWrite: boolean }) {
  const { canWrite } = props;
  const [branches, setBranches] = useState<Array<any>>([]);
  const [ruleSets, setRuleSets] = useState<Array<any>>([]);
  const [savingBranchId, setSavingBranchId] = useState<string>("");

  async function loadAll() {
    const [bRes, rRes] = await Promise.all([
      fetch("/api/org/branches/policy", { credentials: "include" }),
      fetch("/api/policy/rule-sets", { credentials: "include" }),
    ]);
    const bJson = await bRes.json().catch(() => null);
    const rJson = await rRes.json().catch(() => null);
    setBranches(Array.isArray(bJson?.items) ? bJson.items : []);
    setRuleSets(Array.isArray(rJson?.items) ? rJson.items : []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const ruleSetOptions = useMemo(() => {
    return [{ id: "DEFAULT", code: "DEFAULT", name: "Company Policy (Fallback)" }, ...ruleSets];
  }, [ruleSets]);

  async function setBranchRuleSet(branchId: string, value: string) {
    if (!canWrite) {
      return; // RBAC: read-only users must not trigger POST (avoid forbidden toast/flash)
    }
    setSavingBranchId(branchId);
    try {
      if (value === "DEFAULT") {
        await fetch("/api/org/branches/policy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ branchId, clear: true }),
        });
      } else {
        await fetch("/api/org/branches/policy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ branchId, ruleSetId: value }),
        });
      }
      await loadAll();
    } finally {
      setSavingBranchId("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <OrgSubNav />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Branch Policy Assignment</h1>
        <p className="text-sm text-zinc-600">
          SAP-benzeri grouping: BRANCH scope. Precedence: EMPLOYEE &gt; BRANCH &gt; DEFAULT.
        </p>
      </div>

      {!canWrite ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-amber-900">Read-only</div>
              <div className="mt-1 text-sm text-amber-800">
                Bu ekranda değişiklik yapma yetkin yok. Seçimler kilitli; sadece görüntüleyebilirsin.
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              Yetki: Yok
            </span>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-3">
          {branches.map((b) => {
            const current = b.policyRuleSet?.ruleSetId ?? "DEFAULT";
            return (
              <div key={b.id} className="grid gap-2 sm:grid-cols-12 items-center">
                <div className="sm:col-span-5">
                  <div className="text-sm font-medium text-zinc-900">{b.name}</div>
                  <div className="text-xs text-zinc-500">
                    Current:{" "}
                    {b.policyRuleSet ? `${b.policyRuleSet.code} — ${b.policyRuleSet.name}` : "DEFAULT (none)"}
                  </div>
                </div>
                <div className="sm:col-span-5">
                  <select
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={current}
                    onChange={(e) => setBranchRuleSet(b.id, e.target.value)}
                    disabled={!canWrite || savingBranchId === b.id}
                  >
                    {ruleSetOptions.map((rs) => (
                      <option key={rs.id} value={rs.id}>
                        {rs.code} — {rs.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 text-right text-xs text-zinc-500">
                  {savingBranchId === b.id ? "Kaydediliyor…" : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}