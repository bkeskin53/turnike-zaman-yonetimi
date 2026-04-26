"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export default function DataManagementDirtyExitDialog(props: {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!props.open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[160] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[0_28px_80px_rgba(15,23,42,0.24)]"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/80">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.65 18h16.7a1 1 0 00.86-1.5l-7.5-13a1 1 0 00-1.72 0z"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div id={titleId} className="text-base font-bold text-slate-950">
              {props.title ?? "Bu sayfadan çıkılsın mı?"}
            </div>
            <div id={descriptionId} className="mt-1 text-sm leading-6 text-slate-600">
              {props.description ??
                "Kaydedilmemiş değişiklikler silinecek. Bu sayfadan çıkmak istiyor musunuz?"}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="inline-flex min-w-[110px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {props.cancelLabel ?? "Vazgeç"}
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className="inline-flex min-w-[150px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            {props.confirmLabel ?? "Sayfadan Çık"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}