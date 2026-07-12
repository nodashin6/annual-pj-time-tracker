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

/**
 * プロジェクトのグラフ表示色パレット。
 * 自動採番（store.addProject）と新規作成フォームの初期色で共有する単一の真実の源。
 */
export const PALETTE: readonly string[] = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

/**
 * 消化率（実績/予定, %）の色。
 * - 100% 超: 赤（超過）
 * - 80〜100%: 緑（健全）
 * - 50〜79%: 黄（やや余裕）
 * - 50% 未満: 青（余裕）
 */
export function consumptionColor(pct: number): string {
  if (pct > 100) return "#ef4444";
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#0ea5e9";
}

export const hoursFmt = (h: number) => `${h.toLocaleString()} h`;
