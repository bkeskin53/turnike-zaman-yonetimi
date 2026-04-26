export default function EmploymentExclusionNotice({
  data,
  open,
  onToggle,
}: {
  data: {
    count: number;
    limited: number;
    limit: number;
    items: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      lastEmployment: { startDate: string | null; endDate: string | null; reason: string | null } | null;
    }>;
  };
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="font-semibold">Bilgi: Employment validity dışında kalan personel var</div>
          <div className="text-sm">
            Seçilen tarihte <span className="font-medium">{data.count}</span> personel “iş ilişkisi” aralığı dışında olduğu için değerlendirmeye alınmadı
            (DailyAttendance üretilmedi).
          </div>
          {data.count > data.limited ? (
            <div className="text-xs opacity-80">Not: Liste ilk {data.limited} kişi ile sınırlıdır (limit {data.limit}).</div>
          ) : null}
        </div>
        <button className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm hover:bg-amber-100" onClick={onToggle}>
          {open ? "Gizle" : "Detayı göster"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[760px] w-full table-fixed text-sm">
            <thead className="text-amber-900/90">
              <tr>
                <th className="w-[140px] px-2 py-2 text-left">Kod</th>
                <th className="px-2 py-2 text-left">Ad Soyad</th>
                <th className="w-[130px] px-2 py-2 text-left">İşe Baş.</th>
                <th className="w-[130px] px-2 py-2 text-left">Çıkış</th>
                <th className="w-[220px] px-2 py-2 text-left">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/60">
              {data.items.map((x) => (
                <tr key={x.employeeId} className="bg-white/40">
                  <td className="px-2 py-2 font-mono text-xs">{x.employeeCode}</td>
                  <td className="px-2 py-2">{x.fullName || "—"}</td>
                  <td className="px-2 py-2">{x.lastEmployment?.startDate ?? "—"}</td>
                  <td className="px-2 py-2">{x.lastEmployment?.endDate ?? "—"}</td>
                  <td className="px-2 py-2">{x.lastEmployment?.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
