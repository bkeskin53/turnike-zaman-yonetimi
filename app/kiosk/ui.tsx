"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Door = { id: string; code: string; name: string; role?: string | null; defaultDirection: string | null };

type PunchResult =
  | { ok: true; at: string; direction: "IN" | "OUT"; employeeCode: string; fullName: string }
  | { ok: false; message: string };

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function KioskClient({ isAdmin }: { isAdmin: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [code, setCode] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");

  // Optional: door selection (kept minimal; can be hidden later behind "Ayarlar")
  const [doors, setDoors] = useState<Door[]>([]);
  const [doorId, setDoorId] = useState<string>("");
  const [doorsBlocked, setDoorsBlocked] = useState(false);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PunchResult | null>(null);

  // Kiosk PIN gate (device token)
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [lockErr, setLockErr] = useState<string | null>(null);

  const unlocked = useMemo(() => {
    return !!String(pin ?? "").trim();
  }, [pin]);

  const selectedDoor = useMemo(() => {
    if (!doorId) return null;
    return doors.find((d) => d.id === doorId) ?? null;
  }, [doorId, doors]);

  const doorDefaultDir = useMemo(() => {
    const dd = String(selectedDoor?.defaultDirection ?? "").toUpperCase();
    if (dd === "IN" || dd === "OUT") return dd as "IN" | "OUT";
    return null;
  }, [selectedDoor]);

  const isAccessOnlyDoor = useMemo(() => {
    const r = String(selectedDoor?.role ?? "").toUpperCase();
    return r === "ACCESS_ONLY";
  }, [selectedDoor]);

  function getPinFromStorage() {
    try {
      return String(window.sessionStorage.getItem("kiosk_pin") ?? "").trim();
    } catch {
      return "";
    }
  }

  function setPinToStorage(v: string) {
    try {
      if (!v) window.sessionStorage.removeItem("kiosk_pin");
      else window.sessionStorage.setItem("kiosk_pin", v);
    } catch {
      // ignore
    }
  }

  function mapKioskAuthError(code: string) {
    const c = String(code ?? "").trim();
    if (c === "KIOSK_DISABLED") return "Kiosk kapalı. (KIOSK_PIN tanımlı değil) — admin test modu hariç.";
    if (c === "KIOSK_PIN_REQUIRED") return "PIN gerekli.";
    if (c === "KIOSK_PIN_INVALID") return "PIN hatalı.";
    return "Kiosk yetkilendirme başarısız.";
  }

  // Auto-apply door default direction (kiosk ergonomisi)
  useEffect(() => {
    if (!doorDefaultDir) return;
    setDirection(doorDefaultDir);
  }, [doorDefaultDir]);

  const statusTone = useMemo(() => {
    if (!result) return "idle";
    return result.ok ? "ok" : "bad";
  }, [result]);

  // Bootstrap PIN from sessionStorage for kiosk devices
  useEffect(() => {
    const stored = getPinFromStorage();
    if (stored) setPin(stored);
  }, []);

  async function loadDoors() {
    try {
      // Note: /api/org/doors may be session-guarded.
      // If kiosk runs without user session, this may 401/403.
      // In that case we just hide door selector (punch still works without door).
      const headers: Record<string, string> = {};
      if (!isAdmin && pin) headers["x-kiosk-pin"] = pin;

      const res = await fetch("/api/org/doors", { credentials: "include", headers });
      if (!res.ok) {
        setDoorsBlocked(true);
        setDoors([]);
        return;
      }
      const json = await res.json();
      const arr: Door[] = Array.isArray(json) ? json : json.items ?? [];
      setDoors(arr);
      setDoorsBlocked(false);
    } catch {
      // ignore
      setDoorsBlocked(true);
      setDoors([]);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    loadDoors();
  }, [unlocked]);

  // Keep focus in the scanner input (kiosk behavior)
  useEffect(() => {
    if (!unlocked) return;
    inputRef.current?.focus();
  });

  // Auto reset status after a short time (kiosk flow)
  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(() => setResult(null), result.ok ? 2500 : 3500);
    return () => window.clearTimeout(t);
  }, [result]);

  async function unlock() {
    const nextPin = String(pinInput ?? "").trim();
    if (!nextPin || unlocking) return;
    setUnlocking(true);
    setLockErr(null);
    try {
      const res = await fetch("/api/kiosk/auth", {
        method: "GET",
        headers: { "x-kiosk-pin": nextPin },
        credentials: "include",
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || !j?.ok) {
        setLockErr(mapKioskAuthError(String(j?.error ?? "")));
        return;
      }
      setPin(nextPin);
      setPinToStorage(nextPin);
      setPinInput("");
      setResult(null);
    } catch (e: any) {
      setLockErr(e?.message ?? "Bağlantı hatası.");
    } finally {
      setUnlocking(false);
    }
  }

  function logoutKiosk() {
    setPin("");
    setPinInput("");
    setPinToStorage("");
    setDoorId("");
    setDoors([]);
    setResult(null);
    setLockErr(null);
  }

  async function submit() {
    const raw = String(code ?? "").trim();
    if (!raw || busy) return;
    if (!unlocked) return;
    if (doorId && isAccessOnlyDoor) {
      setResult({ ok: false, message: "Bu kapı ACCESS_ONLY (PDKS işlemi yapılamaz)." });
      setCode("");
      return;
    }

    function mapServerError(code: string, httpStatus: number): string {
      const c = String(code ?? "").trim();
      if (c === "employee_not_found") return "Personel bulunamadı (barkod/sicil/kart tanımsız).";
      if (c === "inactive_employee") return "Personel pasif (işlem reddedildi).";

      if (c === "door_not_found") return "Kapı bulunamadı.";
      if (c === "door_inactive") return "Kapı pasif (işlem reddedildi).";
      if (c === "door_access_only") return "Bu kapı ACCESS_ONLY (PDKS işlemi yapılamaz).";

      if (c === "validation_error") return "Geçersiz istek (barkod boş veya hatalı).";
      if (c === "UNAUTHORIZED" || httpStatus === 401) return "Oturum yok / yetkisiz erişim.";
      if (httpStatus === 403) return "Yetki yok (bu işlem için izin gerekli).";

      if (c === "server_error") return "Sunucu hatası. Lütfen tekrar deneyin.";
      return `İşlem başarısız (${c || `HTTP ${httpStatus}`})`;
    }

    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (pin) headers["x-kiosk-pin"] = pin;

      const res = await fetch("/api/kiosk/punch", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          code: raw,
          direction: doorDefaultDir ?? direction,
          doorId: doorId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        const errCode = typeof data?.error === "string" ? data.error : "";
        setResult({ ok: false, message: mapServerError(errCode, res.status) });
        return;
      }

      const json = await res.json();
      const item = json?.item ?? null;
      if (!item?.employeeCode) {
        setResult({ ok: false, message: "Beklenmeyen yanıt (server)." });
        return;
      }

      setResult({
        ok: true,
        at: item.at,
        direction: item.direction,
        employeeCode: item.employeeCode,
        fullName: item.fullName,
      });
      setCode("");
    } catch (e: any) {
      setResult({ ok: false, message: e?.message ?? "Bağlantı hatası." });
    } finally {
      setBusy(false);
      // Keep focus after submit
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    // Kiosk ergonomisi: ESC ile hızlı temizle
    if (e.key === "Escape") {
      setCode("");
      setResult(null);
      inputRef.current?.focus();
    }
  }

  // LOCK SCREEN (PIN gate) — admin bypass
  if (!unlocked) {
    return (
      <div className="mx-auto grid min-h-screen w-full max-w-3xl content-center gap-6 px-4 py-10">
        <header className="grid gap-2 text-center">
          <div className="text-xs font-semibold tracking-widest text-white/60">TURNİKE ZAMAN YÖNETİMİ</div>
          <h1 className="text-2xl font-bold sm:text-3xl">Kiosk Kilitli</h1>
          <p className="text-sm text-white/70">Bu cihaz kiosk PIN ile yetkilendirilmeli.</p>
        </header>

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Kiosk PIN</div>
          <input
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                unlock();
              }
            }}
            placeholder="PIN girin…"
            className="h-14 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-lg text-white outline-none focus:border-white/20 placeholder:text-white/30"
            autoFocus
            inputMode="numeric"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={unlock}
            disabled={unlocking || !String(pinInput ?? "").trim()}
            className="h-12 rounded-xl bg-white text-sm font-semibold text-zinc-950 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-white/50"
          >
            {unlocking ? "Doğrulanıyor…" : "Aç (Enter)"}
          </button>

          {lockErr ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
              {lockErr}
            </div>
          ) : null}

          <div className="text-xs text-white/45">
            Not: PIN bu tarayıcı oturumu boyunca saklanır. (sessionStorage)
          </div>
        </div>

        <footer className="text-center text-xs text-white/35">
          Kiosk güvenliği • Role değil cihaz PIN’e bağlı • Admin test modu hariç
        </footer>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-3xl content-center gap-6 px-4 py-10">
      <header className="grid gap-2 text-center">
        <div className="text-xs font-semibold tracking-widest text-white/60">TURNİKE ZAMAN YÖNETİMİ</div>
        <h1 className="text-2xl font-bold sm:text-3xl">Kiosk Giriş / Çıkış</h1>
        <p className="text-sm text-white/70">
          Barkodu okutun (veya sicil / kart no girip <span className="font-semibold">Enter</span> basın).
        </p>
      </header>

      {/* Small status/identity chip */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
          Mod: <span className="font-semibold text-white">Kiosk PIN</span>
        </span>
        <button onClick={logoutKiosk} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70 hover:bg-white/10">
          Kilitle
        </button>
      </div>

      {/* Direction */}
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Yön</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDirection("IN")}
            disabled={!!doorDefaultDir}
            className={cx(
              "h-14 rounded-xl border text-base font-semibold transition",
              direction === "IN"
                ? "border-emerald-400/50 bg-emerald-500/20 text-white"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
              doorDefaultDir ? "opacity-60 cursor-not-allowed" : ""
            )}
          >
            IN (Giriş)
          </button>
          <button
            type="button"
            onClick={() => setDirection("OUT")}
            disabled={!!doorDefaultDir}
            className={cx(
              "h-14 rounded-xl border text-base font-semibold transition",
              direction === "OUT"
                ? "border-sky-400/50 bg-sky-500/20 text-white"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
              doorDefaultDir ? "opacity-60 cursor-not-allowed" : ""
            )}
          >
            OUT (Çıkış)
          </button>
        </div>

        {/* Optional door */}
        <div className="mt-2 grid gap-1.5">
          <div className="text-xs text-white/50">
            Kapı (opsiyonel){doorDefaultDir ? ` • DefaultDir: ${doorDefaultDir}` : ""}{isAccessOnlyDoor ? " • ACCESS_ONLY" : ""}
          </div>
          <select
            value={doorId}
            onChange={(e) => setDoorId(e.target.value)}
            disabled={doorsBlocked || doors.length === 0}
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="">— Seçilmedi —</option>
            {doors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
          {doorsBlocked ? (
            <div className="text-xs text-white/45">
              Kapı listesi alınamadı (yetki/oturum olabilir). Kiosk, kapı seçmeden çalışır.
            </div>
          ) : null}
          {doorId && isAccessOnlyDoor ? (
            <div className="text-xs text-rose-200">
              Bu kapıda sadece erişim var (ACCESS_ONLY). PDKS punch gönderilemez.
            </div>
          ) : null}
        </div>
      </div>

      {/* Scanner input */}
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Barkod / Sicil / Kart No</div>
        <input
         ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onKeyDown}
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Okutun…"
          className={cx(
            "h-14 w-full rounded-xl border px-4 text-lg outline-none",
            "bg-black/30 text-white placeholder:text-white/30",
            statusTone === "ok"
              ? "border-emerald-400/50"
              : statusTone === "bad"
              ? "border-rose-400/50"
              : "border-white/10 focus:border-white/20"
          )}
        />

        <button
          type="button"
          onClick={submit}
          disabled={busy || !String(code ?? "").trim()}
          className="h-12 rounded-xl bg-white text-sm font-semibold text-zinc-950 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-white/50"
        >
          {busy ? "İşleniyor…" : "Gönder (Enter)"}
        </button>
      </div>

      {/* Status */}
      <div
        className={cx(
          "rounded-2xl border p-4 text-center",
          !result ? "border-white/10 bg-white/5 text-white/70" : "",
          result?.ok ? "border-emerald-400/40 bg-emerald-500/15" : "",
          result && !result.ok ? "border-rose-400/40 bg-rose-500/15" : ""
        )}
      >
        {!result ? (
          <div className="text-sm">Hazır. Barkod okutulabilir.</div>
        ) : result.ok ? (
          <div className="grid gap-1">
            <div className="text-lg font-bold">✓ Kayıt alındı</div>
            <div className="text-sm text-white/80">
              {result.employeeCode} — {result.fullName}
            </div>
            <div className="text-xs text-white/70">
              {result.direction} • {result.at}
            </div>
          </div>
        ) : (
          <div className="grid gap-1">
            <div className="text-lg font-bold">✕ İşlem reddedildi</div>
            <div className="text-sm text-white/85">{result.message}</div>
            <div className="text-xs text-white/60">Tekrar deneyin (ESC ile temizleyebilirsiniz).</div>
          </div>
        )}
      </div>

      <footer className="text-center text-xs text-white/35">
        Kiosk modu • Menü yok • Tek amaç: hızlı ve hatasız punch
      </footer>
    </div>
  );
}
