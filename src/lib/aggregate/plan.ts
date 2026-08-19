/**
 * 予定工数の導出。
 *
 * task は Google Calendar のイベント相当なので、予定工数は枠の長さそのもの。
 * 手入力の予定工数は持たない。
 *
 * 営業時間換算（1日8時間・平日のみ）にしたくなった場合、差し替えるのは
 * plannedHoursOf() 1本だけで済む。
 *
 * このファイルは実績拡張層（TaskEntry / progress.ts）を import しない。
 */
import type { Task } from "../types";

const MS_PER_HOUR = 3_600_000;

/** task の予定工数（時間）。パースできない場合は 0。 */
export function plannedHoursOf(task: Task): number {
  const start = Date.parse(task.startAt);
  const end = Date.parse(task.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const hours = (end - start) / MS_PER_HOUR;
  return hours > 0 ? hours : 0;
}

export const sumPlannedHours = (tasks: Task[]): number =>
  tasks.reduce((a, t) => a + plannedHoursOf(t), 0);

/**
 * 開始日時の年で絞る。
 * 年の判定は overlapsMonth と同じくローカル時刻基準なので、
 * 年末年始をまたぐ task はタイムゾーンによって属する年が変わりうる。
 */
export const tasksInYear = (tasks: Task[], year: number): Task[] =>
  tasks.filter((t) => new Date(t.startAt).getFullYear() === year);

/**
 * task の期間 [startAt, endAt) が year/month の月と重なるか。
 *
 * 両区間とも半開区間として扱う。月ちょうど 00:00 に終わる task は、その月の
 * どの瞬間も占有していないので「重ならない」。実績入力画面のハイライト判定に使う。
 *
 * 月の境界は**実行環境のローカル時刻**で作る（利用者のカレンダー基準で判定するため）。
 * したがって結果は閲覧者のタイムゾーンに依存する。テストを書くときは、
 * フィクスチャの時刻も固定オフセットではなくローカル時刻で組み立てること。
 */
export function overlapsMonth(
  task: Task,
  year: number,
  month: number
): boolean {
  const from = new Date(year, month - 1, 1).getTime();
  const to = new Date(year, month, 1).getTime(); // 翌月1日0時
  const s = Date.parse(task.startAt);
  const e = Date.parse(task.endAt);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
  return s < to && e > from;
}
