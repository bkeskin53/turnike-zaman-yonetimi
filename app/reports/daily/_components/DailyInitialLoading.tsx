export default function DailyInitialLoading() {
  return (
    <div className="rounded-2xl border border-violet-200/70 bg-[linear-gradient(135deg,rgba(245,243,255,0.96),rgba(255,255,255,0.96))] px-4 py-4 shadow-[0_16px_36px_rgba(139,92,246,0.08)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
        <div className="min-w-0">
          <div className="text-sm font-extrabold tracking-tight text-zinc-900">Günlük kayıtlar hazırlanıyor</div>
          <div className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
            Personel satırları, özet alanları ve tablo içeriği yükleniyor. Özellikle yoğun günlerde bu işlem birkaç saniye sürebilir.
          </div>
        </div>
      </div>
    </div>
  );
}
