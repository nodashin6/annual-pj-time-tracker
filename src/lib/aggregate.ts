import type { Worker, Project, Order, Entry } from "./types";
import { MONTHS, MONTH_LABELS } from "./types";

export function filterByYear(entries: Entry[], year: number): Entry[] {
  return entries.filter((e) => e.year === year);
}

/** 月×プロジェクトの積み上げ用データ。Rechartsにそのまま渡せる形。 */
export function monthlyStackByProject(
  entries: Entry[],
  projects: Project[],
  year: number
): Array<Record<string, number | string>> {
  const yEntries = filterByYear(entries, year);
  return MONTHS.map((month, i) => {
    const row: Record<string, number | string> = { month: MONTH_LABELS[i] };
    let total = 0;
    for (const p of projects) {
      const hours = yEntries
        .filter((e) => e.month === month && e.projectId === p.id)
        .reduce((a, e) => a + e.hours, 0);
      row[p.id] = hours;
      total += hours;
    }
    row.total = total;
    return row;
  });
}

/** プロジェクト別 年間合計時間。 */
export function annualByProject(
  entries: Entry[],
  projects: Project[],
  year: number
): Array<{ project: Project; hours: number }> {
  const yEntries = filterByYear(entries, year);
  return projects
    .map((project) => ({
      project,
      hours: yEntries
        .filter((e) => e.projectId === project.id)
        .reduce((a, e) => a + e.hours, 0),
    }))
    .sort((a, b) => b.hours - a.hours);
}

/** ワーカー別 年間投下工数（合計時間のみ。稼働率は扱わない）。 */
export type WorkerHours = { worker: Worker; totalHours: number };
export function workerHours(
  entries: Entry[],
  workers: Worker[],
  year: number
): WorkerHours[] {
  const yEntries = filterByYear(entries, year);
  return workers
    .map((worker) => ({
      worker,
      totalHours: yEntries
        .filter((e) => e.workerId === worker.id)
        .reduce((a, e) => a + e.hours, 0),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

/**
 * 受注別 工数の充足状況。
 * 予定工数(order.plannedHours) に対して 実績(その受注配下プロジェクトの entries 合計) が
 * どれだけ消化されたかを見る。本システムの主眼。
 */
export type OrderProgress = {
  order: Order;
  initialHours: number;
  plannedHours: number;
  actualHours: number;
  /** 実績 / 予定 （%）。予定0なら0。 */
  consumption: number;
};
export function orderProgress(
  entries: Entry[],
  orders: Order[],
  projects: Project[],
  year: number
): OrderProgress[] {
  const yEntries = filterByYear(entries, year);
  return orders
    .map((order) => {
      const pids = new Set(
        projects.filter((p) => p.orderId === order.id).map((p) => p.id)
      );
      const actualHours = yEntries
        .filter((e) => pids.has(e.projectId))
        .reduce((a, e) => a + e.hours, 0);
      const consumption =
        order.plannedHours > 0
          ? Math.round((actualHours / order.plannedHours) * 1000) / 10
          : 0;
      return {
        order,
        initialHours: order.initialHours,
        plannedHours: order.plannedHours,
        actualHours,
        consumption,
      };
    })
    .sort((a, b) => b.plannedHours - a.plannedHours);
}

export type Totals = {
  totalHours: number;
  totalPlanned: number;
  /** 実績 / 予定 （%） */
  consumption: number;
  activeProjects: number;
};

export function orgTotals(
  entries: Entry[],
  orders: Order[],
  projects: Project[],
  year: number
): Totals {
  const yEntries = filterByYear(entries, year);
  const totalHours = yEntries.reduce((a, e) => a + e.hours, 0);
  const totalPlanned = orders.reduce((a, o) => a + o.plannedHours, 0);
  const activeProjects = projects.filter((p) =>
    yEntries.some((e) => e.projectId === p.id && e.hours > 0)
  ).length;
  return {
    totalHours,
    totalPlanned,
    consumption:
      totalPlanned > 0
        ? Math.round((totalHours / totalPlanned) * 1000) / 10
        : 0,
    activeProjects,
  };
}

/** データに存在する年の一覧（降順）。 */
export function availableYears(entries: Entry[], current: number): number[] {
  const years = new Set<number>(entries.map((e) => e.year));
  years.add(current);
  return Array.from(years).sort((a, b) => b - a);
}
