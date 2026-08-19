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

/** 開始日時の年で絞る。 */
export const tasksInYear = (tasks: Task[], year: number): Task[] =>
  tasks.filter((t) => new Date(t.startAt).getFullYear() === year);
