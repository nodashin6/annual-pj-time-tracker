// 共有UIクラスと表示ヘルパ

export const CARD = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
export const INPUT =
  "rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
export const BTN =
  "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_GHOST =
  "rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50";
export const DEL = "rounded px-2 py-1 text-sm text-red-500 hover:bg-red-50";
export const LABEL = "mb-1 block text-xs font-medium text-slate-500";

/** 消化率の色: 予定超過は赤、健全域は緑、余裕は青。 */
export function consumptionColor(pct: number): string {
  if (pct > 100) return "#ef4444";
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#0ea5e9";
}

export const hoursFmt = (h: number) => `${h.toLocaleString()} h`;
