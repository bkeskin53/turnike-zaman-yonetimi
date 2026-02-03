"use client";

import dynamic from "next/dynamic";

// Shell should be client-only to avoid hydration mismatch and to allow
// reading persisted UI prefs (pinned/collapsed) on the very first render.
function SkeletonShell() {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {/* Soft app background (same as AppShell) */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_12%_0%,rgba(59,130,246,0.10),transparent_55%),radial-gradient(900px_520px_at_95%_10%,rgba(99,102,241,0.10),transparent_60%)]" />

      <div className="relative z-0 flex">
        {/* Sidebar skeleton (rail) */}
       <aside className="fixed left-0 top-0 z-10 hidden h-dvh w-[76px] border-r border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 md:block">
          <div className="flex h-dvh flex-col px-2 py-4">
            <div className="flex items-center justify-center">
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/10 ring-1 ring-white/12" />
            </div>

            <div className="mt-4 grid gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center rounded-2xl px-3 py-2.5"
                >
                 <div className="h-9 w-9 animate-pulse rounded-xl border border-white/10 bg-white/8" />
                </div>
              ))}
            </div>

            <div className="mt-auto pb-2">
              <div className="flex items-center justify-center">
                <div className="h-9 w-9 animate-pulse rounded-xl border border-white/10 bg-white/8" />
              </div>
            </div>
          </div>
        </aside>

        {/* Content skeleton */}
        <div className="flex min-w-0 flex-1 flex-col md:ml-[76px]">
          {/* Header skeleton */}
          <header className="sticky top-0 z-10 border-b border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
              <div className="min-w-0 flex-1">
                <div className="h-5 w-44 animate-pulse rounded-lg bg-white/12" />
                <div className="mt-2 h-3 w-64 animate-pulse rounded-lg bg-white/10" />
              </div>

              <div className="hidden lg:block lg:w-105">
                <div className="h-10 w-full animate-pulse rounded-2xl border border-white/10 bg-white/10" />
              </div>

              <div className="flex items-center gap-2">
                <div className="h-10 w-24 animate-pulse rounded-2xl border border-white/10 bg-white/10" />
                <div className="h-10 w-24 animate-pulse rounded-2xl bg-white" />
              </div>
            </div>
          </header>

          {/* Main skeleton */}
          <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
            <div className="rounded-3xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm md:p-6">
              <div className="grid gap-3">
                <div className="h-6 w-56 animate-pulse rounded-xl bg-zinc-200/60" />
                <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-200/50" />
                <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-200/50" />
                <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-zinc-200/50" />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

const AppShellNoSSR = dynamic(() => import("./AppShell"), {
  ssr: false,
  loading: () => <SkeletonShell />,
});

export default AppShellNoSSR;