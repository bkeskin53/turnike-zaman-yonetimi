"use client";

import { useMemo, useState } from "react";
import { type HomeQuickAccessResolvedConfiguration } from "@/src/features/home/homeQuickAccess";

type Notice =
  | {
      kind: "success" | "error";
      text: string;
    }
  | null;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

function humanizeError(code: string | null, fallback: string) {
  switch (code) {
    case "INVALID_HOME_QUICK_ACCESS_CARD_ID":
      return "Kart tanimlarindan biri gecersiz.";
    case "INVALID_HOME_QUICK_ACCESS_CARD_SET":
      return "Tam ve gecerli kart listesi gonderilmelidir.";
    case "INVALID_HOME_QUICK_ACCESS_CARD_ORDER":
      return "Kart sirasi gecersiz.";
    case "INVALID_HOME_QUICK_ACCESS_VISIBILITY":
      return "Gorunurluk degeri yalnizca true veya false olabilir.";
    case "FORBIDDEN":
    case "forbidden":
      return "Bu ayari duzenlemek icin yetkin yok.";
    case "UNAUTHORIZED":
    case "unauthorized":
      return "Oturum bilgisi gecersiz. Lutfen yeniden giris yap.";
    default:
      return fallback;
  }
}

function buildCardsPayload(
  cards: HomeQuickAccessResolvedConfiguration["cards"],
) {
  return cards.map((card, index) => ({
    cardId: card.id,
    isVisible: card.isVisible,
    order: index,
  }));
}

function moveCard<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function buildSignature(cards: HomeQuickAccessResolvedConfiguration["cards"]) {
  return cards
    .map(
      (card, index) =>
        `${card.id}:${index}:${card.isVisible ? "1" : "0"}`,
    )
    .join("|");
}

export default function HomeQuickAccessConfigurationClient(props: {
  initialConfiguration: HomeQuickAccessResolvedConfiguration;
}) {
  const [baseline, setBaseline] = useState(props.initialConfiguration);
  const [cards, setCards] = useState(props.initialConfiguration.cards);
  const [pendingAction, setPendingAction] = useState<"save" | "reset" | null>(
    null,
  );
  const [notice, setNotice] = useState<Notice>(null);

  const isDirty = useMemo(
    () => buildSignature(cards) !== buildSignature(baseline.cards),
    [baseline.cards, cards],
  );

  function toggleVisibility(cardId: string) {
    setCards((current) =>
      current.map((card) =>
        card.id === cardId
          ? { ...card, isVisible: !card.isVisible }
          : card,
      ),
    );
    setNotice(null);
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    setCards((current) => moveCard(current, index, index - 1));
    setNotice(null);
  }

  function moveDown(index: number) {
    if (index >= cards.length - 1) return;
    setCards((current) => moveCard(current, index, index + 1));
    setNotice(null);
  }

  async function saveConfiguration() {
    setPendingAction("save");
    setNotice(null);

    try {
      const response = await fetch("/api/admin/home/quick-access-configuration", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cards: buildCardsPayload(cards),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({
          kind: "error",
          text: humanizeError(
            extractApiError(payload),
            "Ayarlar kaydedilemedi.",
          ),
        });
        return;
      }

      const configuration = payload?.configuration as
        | HomeQuickAccessResolvedConfiguration
        | undefined;

      if (!configuration?.cards) {
        setNotice({
          kind: "error",
          text: "Sunucudan gecerli konfigurasyon donmedi.",
        });
        return;
      }

      setBaseline(configuration);
      setCards(configuration.cards);
      setNotice({
        kind: "success",
        text: "Home hizli erisim ayarlari kaydedildi.",
      });
    } catch {
      setNotice({
        kind: "error",
        text: "Ayarlar kaydedilirken baglanti hatasi olustu.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function resetConfiguration() {
    setPendingAction("reset");
    setNotice(null);

    try {
      const response = await fetch("/api/admin/home/quick-access-configuration", {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({
          kind: "error",
          text: humanizeError(
            extractApiError(payload),
            "Varsayilan ayarlara donulemedi.",
          ),
        });
        return;
      }

      const configuration = payload?.configuration as
        | HomeQuickAccessResolvedConfiguration
        | undefined;

      if (!configuration?.cards) {
        setNotice({
          kind: "error",
          text: "Sunucudan gecerli konfigurasyon donmedi.",
        });
        return;
      }

      setBaseline(configuration);
      setCards(configuration.cards);
      setNotice({
        kind: "success",
        text: "Varsayilan home hizli erisim sirasi geri yuklendi.",
      });
    } catch {
      setNotice({
        kind: "error",
        text: "Varsayilan ayarlar yuklenirken baglanti hatasi olustu.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="min-w-0">
          <div className="text-base font-semibold tracking-tight text-slate-950">
            Home Hızlı Erişim
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Ana sayfada gösterilecek kartların sırasını ve görünürlüğünü yönetin.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          className={cx(
            "mt-3 rounded-xl border px-3 py-2 text-sm font-medium",
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
          role="status"
        >
          {notice.text}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {cards.map((card, index) => (
          <div
            key={card.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 xl:flex-row xl:items-center xl:justify-between"
          >
            <div className="min-w-0 flex items-start gap-3">
              <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600">
                {index + 1}
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  {card.title}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {card.description}
                </div>
                <div className="mt-1 truncate text-[11px] font-medium text-slate-500">
                  {card.href}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => moveUp(index)}
                disabled={pendingAction !== null || index === 0}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Yukarı
              </button>

              <button
                type="button"
                onClick={() => moveDown(index)}
                disabled={pendingAction !== null || index === cards.length - 1}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Aşağı
              </button>

              <button
                type="button"
                onClick={() => toggleVisibility(card.id)}
                disabled={pendingAction !== null}
                className={cx(
                  "inline-flex min-w-[108px] items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                  card.isVisible
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                {card.isVisible ? "Görünür" : "Gizli"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={resetConfiguration}
          disabled={pendingAction !== null}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Varsayılanı Yükle
        </button>
        <button
          type="button"
          onClick={saveConfiguration}
          disabled={pendingAction !== null || !isDirty}
          className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === "save" ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </section>
  );
}