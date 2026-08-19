/**
 * 実績の集計(実績拡張層)。
 *
 * この層はコア層(tree.ts / plan.ts)を一方向に参照する。逆は無い。
 */
import type { Pj, Task, TaskEntry, Tracker, Worker } from "../types";
import { MONTHS, MONTH_LABELS } from "../types";
import { contractNodes, descendantIds, leafPjs } from "./tree";
import { sumPlannedHours, tasksInYear } from "./plan";

const pct = (actual: number, planned: number): number =>
  planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0;

export const filterByYear = (entries: TaskEntry[], year: number): TaskEntry[] =>
  entries.filter((e) => e.year === year);

/** 実績と task の両方に現れる年の一覧(降順)。 */
export function availableYears(
  entries: TaskEntry[],
  tasks: Task[],
  current: number
): number[] {
  const years = new Set<number>(entries.map((e) => e.year));
  for (const t of tasks) {
    const y = new Date(t.startAt).getFullYear();
    if (Number.isFinite(y)) years.add(y);
  }
  years.add(current);
  return Array.from(years).sort((a, b) => b - a);
}

/** taskId -> その task が属する葉pjのid。 */
const taskToLeaf = (tasks: Task[]): Map<string, string> =>
  new Map(tasks.map((t) => [t.id, t.trackerPjId]));

/** taskId -> 担当ワーカーid。 */
const taskToWorker = (tasks: Task[]): Map<string, string> =>
  new Map(tasks.map((t) => [t.id, t.assigneeId]));

/** 月×葉pj の積み上げ用データ。Recharts にそのまま渡せる形。 */
export function monthlyStackByLeaf(
  entries: TaskEntry[],
  tasks: Task[],
  leaves: Pj[],
  year: number
): Array<Record<string, number | string>> {
  const yEntries = filterByYear(entries, year);
  const leafOf = taskToLeaf(tasks);
  return MONTHS.map((month, i) => {
    const row: Record<string, number | string> = { month: MONTH_LABELS[i] };
    let total = 0;
    for (const leaf of leaves) {
      const hours = yEntries
        .filter((e) => e.month === month && leafOf.get(e.taskId) === leaf.id)
        .reduce((a, e) => a + e.hours, 0);
      row[leaf.id] = hours;
      total += hours;
    }
    row.total = total;
    return row;
  });
}

/** 葉pj別 年間合計時間。 */
export function annualByLeaf(
  entries: TaskEntry[],
  tasks: Task[],
  leaves: Pj[],
  year: number
): Array<{ pj: Pj; hours: number }> {
  const yEntries = filterByYear(entries, year);
  const leafOf = taskToLeaf(tasks);
  return leaves
    .map((pj) => ({
      pj,
      hours: yEntries
        .filter((e) => leafOf.get(e.taskId) === pj.id)
        .reduce((a, e) => a + e.hours, 0),
    }))
    .sort((a, b) => b.hours - a.hours);
}

export type WorkerHours = { worker: Worker; totalHours: number };

/** ワーカー別 年間投下工数。担当者は task.assigneeId から引く。 */
export function workerHours(
  entries: TaskEntry[],
  tasks: Task[],
  workers: Worker[],
  year: number
): WorkerHours[] {
  const yEntries = filterByYear(entries, year);
  const workerOf = taskToWorker(tasks);
  return workers
    .map((worker) => ({
      worker,
      totalHours: yEntries
        .filter((e) => workerOf.get(e.taskId) === worker.id)
        .reduce((a, e) => a + e.hours, 0),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

export type ContractProgress = {
  pj: Pj;
  /** 配下 task の枠の長さの合計(導出値)。 */
  plannedHours: number;
  actualHours: number;
  /** 実績 / 予定(%)。予定0なら0。 */
  consumption: number;
};

/**
 * 契約ノード別 工数の充足状況。
 * 予定は配下 task の期間から導出するので、task が1件も無い契約の予定は 0 になる。
 */
export function contractProgress(
  entries: TaskEntry[],
  tasks: Task[],
  pjs: Pj[],
  year: number
): ContractProgress[] {
  const yEntries = filterByYear(entries, year);
  const yTasks = tasksInYear(tasks, year);
  return contractNodes(pjs)
    .map((pj) => {
      const scope = new Set(descendantIds(pj.id, pjs));
      // 予定: その年に開始する task のみ。
      const scoped = yTasks.filter((t) => scope.has(t.trackerPjId));
      const plannedHours = sumPlannedHours(scoped);
      // 実績: task の開始年に関係なく、このサブツリーに属する task の実績を年で絞る。
      // task_entries は月をまたぐ task の実績を実測で年ごとに分けて持てるようにする
      // ためのものなので、task.startAt の年と entry.year は一致しないことがある。
      const scopeTaskIds = new Set(
        tasks.filter((t) => scope.has(t.trackerPjId)).map((t) => t.id)
      );
      const actualHours = yEntries
        .filter((e) => scopeTaskIds.has(e.taskId))
        .reduce((a, e) => a + e.hours, 0);
      return {
        pj,
        plannedHours,
        actualHours,
        consumption: pct(actualHours, plannedHours),
      };
    })
    .sort((a, b) => b.plannedHours - a.plannedHours);
}

export type Totals = {
  totalHours: number;
  totalPlanned: number;
  /** 実績 / 予定(%) */
  consumption: number;
  /** その年に実績のある葉pjの数。 */
  activeLeaves: number;
};

export function orgTotals(
  entries: TaskEntry[],
  tasks: Task[],
  pjs: Pj[],
  trackers: Tracker[],
  year: number
): Totals {
  const yEntries = filterByYear(entries, year);
  const yTasks = tasksInYear(tasks, year);
  const leafOf = taskToLeaf(tasks);
  const totalHours = yEntries.reduce((a, e) => a + e.hours, 0);
  const totalPlanned = sumPlannedHours(yTasks);
  const activeLeaves = leafPjs(pjs, trackers).filter((leaf) =>
    yEntries.some((e) => e.hours > 0 && leafOf.get(e.taskId) === leaf.id)
  ).length;
  return {
    totalHours,
    totalPlanned,
    consumption: pct(totalHours, totalPlanned),
    activeLeaves,
  };
}
