"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function VersionedEditModalShell(props: {
  open: boolean;
  title: string;
  subtitle?: string;
  saving?: boolean;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  if (!props.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <div className="flex h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_35px_90px_rgba(15,23,42,0.28)]">
        <div className="shrink-0 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="grid gap-1">
            <div className="text-xl font-semibold tracking-tight text-slate-950">{props.title}</div>
            {props.subtitle ? <div className="text-sm leading-6 text-slate-600">{props.subtitle}</div> : null}
          </div>
          <button
            type="button"
            className={cx(
              "inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
              props.saving ? "cursor-not-allowed opacity-60" : "",
            )}
            onClick={props.onClose}
            disabled={props.saving}
            aria-label="Kapat"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{props.children}</div>
        <div className="shrink-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          {props.footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}
