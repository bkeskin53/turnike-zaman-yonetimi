"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HOME_HERO_CONTENT,
  HOME_QUICK_ACCESS_CONTENT,
  type HomeQuickAccessCard,
  type HomeCardIcon,
  type HomeCardTone,
} from "./content";

const HERO_SLIDES = [
  "/images/home/hero-city.png",
  "/images/home/hero-dataflow.png",
  "/images/home/hero-office.png",
] as const;

const HERO_AUTOPLAY_INTERVAL_MS = 8000;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function cardToneClasses(tone: HomeCardTone) {
  const map: Record<HomeCardTone, string> = {
    blue: "border-sky-200/80 bg-[linear-gradient(145deg,rgba(239,246,255,0.98),rgba(255,255,255,0.98),rgba(224,242,254,0.88))] hover:shadow-[0_20px_40px_rgba(14,116,144,0.12)]",
    violet: "border-violet-200/80 bg-[linear-gradient(145deg,rgba(245,243,255,0.98),rgba(255,255,255,0.98),rgba(237,233,254,0.9))] hover:shadow-[0_20px_40px_rgba(124,58,237,0.12)]",
    teal: "border-teal-200/80 bg-[linear-gradient(145deg,rgba(240,253,250,0.98),rgba(255,255,255,0.98),rgba(204,251,241,0.88))] hover:shadow-[0_20px_40px_rgba(13,148,136,0.12)]",
    rose: "border-rose-200/80 bg-[linear-gradient(145deg,rgba(255,241,242,0.98),rgba(255,255,255,0.98),rgba(255,228,230,0.9))] hover:shadow-[0_20px_40px_rgba(225,29,72,0.12)]",
    slate: "border-slate-200/80 bg-[linear-gradient(145deg,rgba(241,245,249,0.98),rgba(255,255,255,0.98),rgba(226,232,240,0.9))] hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)]",
    indigo: "border-indigo-200/80 bg-[linear-gradient(145deg,rgba(238,242,255,0.98),rgba(255,255,255,0.98),rgba(224,231,255,0.9))] hover:shadow-[0_20px_40px_rgba(79,70,229,0.12)]",
    cyan: "border-cyan-200/80 bg-[linear-gradient(145deg,rgba(236,254,255,0.98),rgba(255,255,255,0.98),rgba(207,250,254,0.9))] hover:shadow-[0_20px_40px_rgba(8,145,178,0.12)]",
    amber: "border-amber-200/80 bg-[linear-gradient(145deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98),rgba(254,243,199,0.88))] hover:shadow-[0_20px_40px_rgba(217,119,6,0.12)]",
  };

  return map[tone];
}

function iconToneClasses(tone: HomeCardTone) {
  const map: Record<HomeCardTone, string> = {
    blue: "bg-sky-600 text-white ring-sky-200/80",
    violet: "bg-violet-600 text-white ring-violet-200/80",
    teal: "bg-teal-600 text-white ring-teal-200/80",
    rose: "bg-rose-600 text-white ring-rose-200/80",
    slate: "bg-slate-800 text-white ring-slate-200/80",
    indigo: "bg-indigo-600 text-white ring-indigo-200/80",
    cyan: "bg-cyan-600 text-white ring-cyan-200/80",
    amber: "bg-amber-500 text-slate-950 ring-amber-200/80",
  };

  return map[tone];
}

function QuickAccessIcon(props: { name: HomeCardIcon; className?: string }) {
  const common = {
    className: props.className ?? "h-5 w-5",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (props.name) {
    case "employees":
      return (
        <svg {...common}>
          <path d="M8 12a3 3 0 100-6 3 3 0 000 6Z" stroke="currentColor" strokeWidth="1.9" />
          <path d="M16 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" stroke="currentColor" strokeWidth="1.9" opacity="0.85" />
          <path d="M4.5 19c1.2-2.8 3.8-4.2 6-4.2 2.2 0 4.8 1.4 6 4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M14.2 15.2c2 .2 3.8 1.4 4.8 3.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity="0.85" />
        </svg>
      );
    case "import":
      return (
        <svg {...common}>
          <path d="M12 4v10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="m8.5 10.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 18.5h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case "planner":
      return (
        <svg {...common}>
          <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M4.5 7.5h15v12h-15z" stroke="currentColor" strokeWidth="1.9" />
          <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M4.5 7.5h15v12h-15z" stroke="currentColor" strokeWidth="1.9" />
          <path d="m9 14 2 2 4-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <path d="M4.5 12.5H10V4.5H4.5v8Zm9.5 7h5.5v-6.5H14v6.5Zm-9.5 0H10v-4.5H4.5v4.5Zm9.5-9H19.5v-6H14v6Z" fill="currentColor" />
        </svg>
      );
    case "payroll":
      return (
        <svg {...common}>
          <path d="M6 19V9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M11 19V5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M16 19v-8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M21 19V7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case "mapping":
      return (
        <svg {...common}>
          <path d="M5 7h6v4H5zM13 13h6v4h-6z" stroke="currentColor" strokeWidth="1.9" />
          <path d="M11 9h2.5a2.5 2.5 0 0 1 2.5 2.5V13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="m15.5 10.5 1.9 1.9 1.9-1.9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "audit":
      return (
        <svg {...common}>
          <path d="M6.5 4.5h11v15l-5.5-2.6-5.5 2.6v-15Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M9 8.5h6M9 12h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function HeroArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {direction === "left" ? (
        <path
          d="m11.5 4.5-5 5 5 5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="m8.5 4.5 5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export default function HomeLandingPage(props: { cards: HomeQuickAccessCard[] }) {
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  useEffect(() => {
    if (HERO_SLIDES.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, HERO_AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  function goToSlide(index: number) {
    setActiveHeroSlide(index);
  }

  function showPreviousSlide() {
    setActiveHeroSlide((current) => (current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }

  function showNextSlide() {
    setActiveHeroSlide((current) => (current + 1) % HERO_SLIDES.length);
  }

  return (
    <div className="grid gap-6">
      <section className="relative isolate -mx-6 -mt-6 overflow-hidden rounded-none border-x-0 border-t-0 border-b border-slate-800/8 px-6 py-5 text-white shadow-none md:min-h-[228px] md:px-8 md:py-6">        {HERO_SLIDES.map((slideSrc, index) => (
          <Image
            key={slideSrc}
            src={slideSrc}
            alt=""
            fill
            priority={index === 0}
            sizes="(max-width: 768px) 100vw, 1200px"
            className={cx(
              "object-cover object-center transition-opacity duration-700 ease-out",
              index === activeHeroSlide ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.88)_0%,rgba(15,23,42,0.78)_28%,rgba(15,23,42,0.52)_56%,rgba(15,23,42,0.34)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(125,211,252,0.14),transparent_28%),radial-gradient(circle_at_82%_24%,rgba(244,114,182,0.10),transparent_26%),radial-gradient(circle_at_72%_84%,rgba(94,234,212,0.10),transparent_24%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.20)_100%)]" />
        <div className="pointer-events-none absolute -right-16 top-10 h-48 w-48 rounded-full border border-white/10 bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute bottom-[-64px] left-[-48px] h-40 w-40 rounded-full border border-white/10 bg-white/5 blur-2xl" />

        <div className="absolute right-4 top-4 z-20 flex items-center gap-2 md:right-5 md:top-5">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-slate-950/24 px-2 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.20)] backdrop-blur-md">
            <button
              type="button"
              aria-label="Önceki banner görseli"
              onClick={showPreviousSlide}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/90 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            >
              <HeroArrowIcon direction="left" />
            </button>

            <div className="flex items-center gap-1.5 px-1">
              {HERO_SLIDES.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Banner görseli ${index + 1}`}
                  aria-pressed={index === activeHeroSlide}
                  onClick={() => goToSlide(index)}
                  className={cx(
                    "h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
                    index === activeHeroSlide ? "w-6 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70",
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              aria-label="Sonraki banner görseli"
              onClick={showNextSlide}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/90 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            >
              <HeroArrowIcon direction="right" />
            </button>
          </div>
        </div>

        <div className="relative grid gap-4">
          <div className="grid gap-4">
            <div className="grid gap-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {HOME_HERO_CONTENT.title}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-100/88 md:text-base">
                {HOME_HERO_CONTENT.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{HOME_QUICK_ACCESS_CONTENT.title}</h2>
            <p className="text-sm text-slate-600">{HOME_QUICK_ACCESS_CONTENT.description}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {props.cards.map((card) => {
            const isManageCard = "kind" in card && card.kind === "manage";

            return (
              <Link
                key={card.id}
                href={card.href}
                className={cx(
                  "group relative flex min-h-[188px] flex-col overflow-hidden rounded-[28px] border p-5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition duration-200",
                  "hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40",
                  isManageCard
                    ? "border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98))] hover:border-slate-400 hover:bg-white"
                    : cardToneClasses(card.tone),
                )}
              >
                <div
                  className={cx(
                    "pointer-events-none absolute inset-0 opacity-80",
                    isManageCard
                      ? "bg-[radial-gradient(circle_at_top_right,rgba(226,232,240,0.55),transparent_36%)]"
                      : "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.72),transparent_32%)]",
                  )}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <div
                    className={cx(
                      "inline-flex items-center justify-center ring-1 shadow-[0_10px_24px_rgba(15,23,42,0.10)]",
                      isManageCard
                        ? "h-16 w-16 rounded-[22px] border border-slate-200 bg-white text-slate-700 ring-slate-200"
                        : "h-12 w-12 rounded-2xl",
                      isManageCard ? "" : iconToneClasses(card.tone),
                    )}
                  >
                    <QuickAccessIcon
                      name={card.icon}
                      className={isManageCard ? "h-9 w-9" : "h-5 w-5"}
                    />
                  </div>

                  <span className="inline-flex items-center rounded-full border border-slate-900/8 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm">
                    {isManageCard ? "Home Ayarı" : "Modül"}
                  </span>
                </div>

                <div className="relative mt-5 grid gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    {card.title}
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    {card.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
