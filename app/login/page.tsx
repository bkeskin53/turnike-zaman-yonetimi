import LoginClient from "./ui";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_480px_at_20%_10%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(900px_480px_at_90%_20%,rgba(59,130,246,0.18),transparent_60%)]" />

      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-2">
          <div className="hidden lg:block">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="text-xs font-bold uppercase tracking-wider text-white/60">Turnike Zaman Yönetimi</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight">Kurumsal PDKS</div>
              <div className="mt-3 text-sm leading-relaxed text-white/70">
                Rol tabanlı erişim (RBAC), Supervisor Scope v3 ve operasyon raporları için tek giriş noktası.
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                <div className="font-bold text-white/85">Dev Notu</div>
                <div className="mt-2">
                  Varsayılan: <span className="font-mono text-white/90">admin@local</span> /{" "}
                  <span className="font-mono text-white/90">Admin123!</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-8">
            <div className="text-sm font-bold text-white/70">Giriş</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Hesabınıza erişin</h1>
            <p className="mt-2 text-sm text-white/65">
              Giriş başarılı olunca rolünüze göre en uygun ekrana yönlendirileceksiniz.
            </p>
            <div className="mt-6">
              <LoginClient />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
