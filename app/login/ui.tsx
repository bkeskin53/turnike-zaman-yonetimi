"use client";

import { useState } from "react";

type UserRole = "SYSTEM_ADMIN" | "HR_CONFIG_ADMIN" | "HR_OPERATOR" | "SUPERVISOR";

export default function LoginClient() {
  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("Admin123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redirectByRole() {
    // Prefer server truth (session cookie is already set by /api/auth/login)
    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      if (!meRes.ok) {
        window.location.href = "/home";
        return;
      }
      const me = await meRes.json().catch(() => null);
      const role = (me?.user?.role ?? null) as UserRole | null;

      // Enterprise default landing
      if (role === "SYSTEM_ADMIN") return (window.location.href = "/home");
      if (role === "HR_CONFIG_ADMIN") return (window.location.href = "/home");
      if (role === "HR_OPERATOR") return (window.location.href = "/home");
      if (role === "SUPERVISOR") return (window.location.href = "/home");

      window.location.href = "/home";
    } catch {
      window.location.href = "/home";
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ? String(data.error) : `Login failed (${res.status})`);
        return;
      }

      await redirectByRole();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {error && (
        <div className="rounded-2xl border border-rose-300/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          <div className="font-bold">Giriş başarısız</div>
          <div className="mt-1 text-rose-100/90">{error}</div>
        </div>
      )}

      <label className="grid gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-white/60">E-posta</span>
        <input
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/15"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@firma.com"
          autoComplete="username"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-white/60">Şifre</span>
        <input
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/15"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </label>

      <button
        disabled={loading}
        type="submit"
        className="mt-2 inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-zinc-900 shadow-sm transition hover:bg-zinc-100 disabled:opacity-60"
      >
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>

      <div className="text-xs text-white/55">
        Not: Bu ekran dev ortamı için. Prod ortamda SSO / MFA eklenebilir.
      </div>
    </form>
  );
}
