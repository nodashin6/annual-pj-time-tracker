"use client";

import { useEffect } from "react";
import { useNotify, type Toast } from "@/lib/notify";

const KIND_STYLE: Record<Toast["kind"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-200 bg-white text-slate-700",
};

const KIND_ICON: Record<Toast["kind"], string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

/** 画面右下に積み上がるトースト表示。5 秒で自動消滅。 */
export function Toaster() {
  const toasts = useNotify((s) => s.toasts);
  const dismiss = useNotify((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-md ${KIND_STYLE[toast.kind]}`}
    >
      <span aria-hidden className="mt-0.5 font-bold">
        {KIND_ICON[toast.kind]}
      </span>
      <span className="min-w-0 flex-1 break-words">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100"
        aria-label="閉じる"
      >
        ✕
      </button>
    </div>
  );
}
