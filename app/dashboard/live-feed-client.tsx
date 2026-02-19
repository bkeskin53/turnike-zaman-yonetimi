"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";

/**
 * LiveFeedClient component periodically fetches the latest raw events from
 * the dashboard live‑feed API endpoint and renders them in a simple list.
 * It accepts a timezone string so that timestamps can be formatted
 * consistently with the rest of the dashboard.  The component uses
 * client‑side polling (every 5 seconds) to simulate a real‑time feed.
 */
export default function LiveFeedClient({ tz }: { tz: string }) {
  type FeedEvent = {
    id: string;
    occurredAt: string;
    direction: "IN" | "OUT";
    source: string;
    employee: { employeeCode: string; firstName: string; lastName: string };
    door: { code: string; name: string } | null;
    device: { name: string | null } | null;
  };

  const MAX_VISIBLE = 10; // UI: fixed-height list like "Son Olaylar"
  const [events, setEvents] = useState<FeedEvent[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    async function fetchEvents() {
      try {
        const res = await fetch("/api/dashboard/live-feed");
        if (res.ok) {
          const j = await res.json();
          if (j?.ok) {
            setEvents(j.events ?? []);
          }
        }
      } catch {
        // Ignore fetch errors in feed
      }
    }
    // initial fetch
    fetchEvents();
    // poll every 5 seconds
    timer = setInterval(fetchEvents, 5000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const visible = events.slice(0, MAX_VISIBLE);

  function dirPill(direction: "IN" | "OUT") {
    const cls =
      direction === "IN"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-900";
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${cls}`}
      >
        {direction}
      </span>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="text-sm font-semibold">Canlı Geçiş Akışı</div>
      <div className="mt-1 text-xs text-zinc-500">Son turnike geçişleri (her 5 sn güncellenir)</div>
      {/* List region fills remaining card height + hidden scrollbar */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-2">
          {visible.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-sm font-medium">Henüz canlı kayıt yok</div>
              <div className="mt-1 text-xs text-zinc-600">
                Bu alan turnike/cihazdan gelen ham geçişleri gösterir. Gün içinde hiç kayıt yoksa normal olabilir veya cihaz bağlantısı
                kontrol edilmelidir.
              </div>
              <a className="mt-2 inline-block text-xs underline text-zinc-700" href="/events">
                Ham olayları aç →
              </a>
            </div>
          ) : (
            visible.map((ev) => (
              <div
                key={ev.id}
                className={
                  "flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                }
              >
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">
                      {DateTime.fromISO(ev.occurredAt).setZone(tz).toFormat("HH:mm")}
                    </span>{" "}
                    <span className="font-medium">{ev.employee.employeeCode}</span>{" "}
                    <span className="text-zinc-600">
                      {ev.employee.firstName} {ev.employee.lastName}
                    </span>
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {ev.door
                      ? `${ev.door.code} • ${ev.door.name}`
                      : ev.device?.name
                        ? `${ev.device.name}`
                        : ""}
                  </div>
                </div>
                <div className="ml-3 shrink-0">{dirPill(ev.direction)}</div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Footer meta (always visible at bottom) */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          Gösterilen: {Math.min(MAX_VISIBLE, events.length)} / {events.length}
        </span>
        <a className="text-zinc-700 underline" href="/events">
          Tüm olaylar →
        </a>
      </div>
    </div>
  );
}
