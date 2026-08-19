/**
 * tracker / task の「期間パッチを現在値とマージしてから順序を検証する」処理。
 *
 * `trackerPatchSchema` / `taskPatchSchema` は `.partial()` で作っているため、
 * 入力スキーマの `.refine()`（開始 <= 終了 / 開始 < 終了）は patch 単体には
 * 掛からない（片方の endpoint だけの patch では検証できないため）。
 * そこでストア側（core.ts の updateTracker / updateTask）が、patch を現在の
 * 行にマージした値に対して同じ検証をここで再現する。
 *
 * 2つの関数は似ているが、意図的に非対称:
 * - tracker の start/end は nullable 列なので `"in" in patch` でキーの有無を
 *   判定する（patch に無いキーは現在値を維持、`undefined` は明示的なクリア）。
 *   start == end も許容する（同日開始・終了があり得るため）。
 * - task の startAt/endAt は NOT NULL 列（クリア不可）なので `??` で
 *   現在値にフォールバックする。start < end を厳密に要求する（task は
 *   正の長さを持つ枠であるため）。
 *
 * 純関数なのでテストしやすい。DB / store の副作用は一切持たない。
 */
import { TRACKER_ORDER_MESSAGE, TASK_ORDER_MESSAGE } from "../schemas";

export type MergeResult =
  | { ok: true; start: string | undefined; end: string | undefined }
  | { ok: false; message: string };

/**
 * tracker の startDate/endDate パッチを現在の tracker とマージし、
 * startDate <= endDate（両方揃っている場合のみ）を検証する。
 */
export function mergeTrackerDates(
  current: { startDate?: string; endDate?: string } | undefined,
  patch: { startDate?: string; endDate?: string }
): MergeResult {
  const start = "startDate" in patch ? patch.startDate : current?.startDate;
  const end = "endDate" in patch ? patch.endDate : current?.endDate;
  if (start && end && start > end) {
    return { ok: false, message: TRACKER_ORDER_MESSAGE };
  }
  return { ok: true, start, end };
}

/**
 * task の startAt/endAt パッチを現在の task とマージし、
 * startAt < endAt（両方揃っている場合のみ）を検証する。
 */
export function mergeTaskDates(
  current: { startAt?: string; endAt?: string } | undefined,
  patch: { startAt?: string; endAt?: string }
): MergeResult {
  const start = patch.startAt ?? current?.startAt;
  const end = patch.endAt ?? current?.endAt;
  if (start && end && !(Date.parse(start) < Date.parse(end))) {
    return { ok: false, message: TASK_ORDER_MESSAGE };
  }
  return { ok: true, start, end };
}
