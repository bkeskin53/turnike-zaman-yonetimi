import AppShell from "@/app/_components/AppShellNoSSR";
import Link from "next/link";

export default function WorkforceHomePage() {
  return (
    <AppShell title="Workforce" subtitle="Personel segmentleri • alt segmentler • sınıflandırma">
      <div className="grid gap-5">
        {/* Hero / intro */}
        <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-b from-white to-violet-50/30 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-lg font-extrabold tracking-tight text-zinc-900">Workforce Yapısı</div>
                <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-800 ring-1 ring-inset ring-violet-200/60 uppercase tracking-tight shadow-sm">
                  Segment • Kural Hiyerarşisi
                </span>
              </div>
              <div className="mt-1 text-sm text-zinc-600 font-medium leading-relaxed">
                Personelleri kurumsal yapınıza göre <b>segment</b> ve <b>alt segment</b> altında toplar; kuralları bu sınıflandırmaya göre daha
                yönetilebilir hale getirirsiniz.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                href="/workforce/classification"
                title="Personelleri segmentlere bağla"
              >
                Personel Sınıflandırma
                <span aria-hidden className="text-zinc-400">→</span>
              </Link>
            </div>
          </div>

          {/* Resolve order banner */}
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
            <div className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Kural çözümleme sırası</div>
            <div className="mt-1 text-sm text-amber-900/90 font-semibold">
              Personel → Alt Segment → Segment → Şube
            </div>
            <div className="mt-1 text-[11px] text-amber-900/70">
              Üstteki katmanlar alttakileri ezer. (Sadece görsel bilgilendirme)
            </div>
          </div>
        </div>

        {/* Tiles */}
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            href="/workforce/groups"
            className="group rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:shadow-md hover:-translate-y-[1px]"
            title="Segmentleri yönet"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-zinc-900 tracking-tight">Segmentler</div>
                <div className="mt-1 text-xs text-zinc-500 font-medium leading-relaxed">
                  Kuralları üst seviyede gruplayın (örn. Ofis / Saha / Vardiya).
                </div>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 ring-1 ring-inset ring-zinc-200/70">
                Groups
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
              Yönet
              <span aria-hidden className="text-indigo-400 group-hover:translate-x-[2px] transition-transform">→</span>
            </div>
          </Link>

          <Link
            href="/workforce/subgroups"
            className="group rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:shadow-md hover:-translate-y-[1px]"
            title="Alt segmentleri yönet"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
               <div className="text-sm font-extrabold text-zinc-900 tracking-tight">Alt Segmentler</div>
                <div className="mt-1 text-xs text-zinc-500 font-medium leading-relaxed">
                  Segment altında daha ince kırılım (örn. Bölge / Kadro / Ünvan).
                </div>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 ring-1 ring-inset ring-zinc-200/70">
                Subgroups
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
              Yönet
              <span aria-hidden className="text-indigo-400 group-hover:translate-x-[2px] transition-transform">→</span>
            </div>
          </Link>

          <Link
            href="/workforce/classification"
            className="group rounded-2xl border border-indigo-200/70 bg-gradient-to-b from-white to-indigo-50/30 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:shadow-md hover:-translate-y-[1px]"
            title="Personelleri segment/alt segmente bağla"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-zinc-900 tracking-tight">Personel Sınıflandırma</div>
                <div className="mt-1 text-xs text-zinc-600 font-medium leading-relaxed">
                  Personelleri segmentlere bağlayın; kuralların hedefi netleşsin.
                </div>
              </div>
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-inset ring-indigo-500/30">
                Önerilen
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
              Başla
              <span aria-hidden className="text-indigo-400 group-hover:translate-x-[2px] transition-transform">→</span>
            </div>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}