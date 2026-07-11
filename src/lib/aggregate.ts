import type { Worker, Project, Entry } from "./types";
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

/** ワーカー別 月次稼働率（投下時間 / キャパ）。 */
export function monthlyUtilization(
  entries: Entry[],
  workers: Worker[],
  year: number
): Array<Record<string, number | string>> {
  const yEntries = filterByYear(entries, year);
  return MONTHS.map((month, i) => {
    const row: Record<string, number | string> = { month: MONTH_LABELS[i] };
    for (const w of workers) {
      const hours = yEntries
        .filter((e) => e.month === month && e.workerId === w.id)
        .reduce((a, e) => a + e.hours, 0);
      const util =
        w.monthlyCapacityHours > 0
          ? Math.round((hours / w.monthlyCapacityHours) * 1000) / 10
          : 0;
      row[w.id] = util;
    }
    return row;
  });
}

export type WorkerSummary = {
  worker: Worker;
  totalHours: number;
  capacityHours: number;
  utilization: number; // %
};

/** ワーカー別 年間サマリ（合計時間・年間キャパ・稼働率）。 */
export function workerSummaries(
  entries: Entry[],
  workers: Worker[],
  year: number
): WorkerSummary[] {
  const yEntries = filterByYear(entries, year);
  return workers.map((worker) => {
    const totalHours = yEntries
      .filter((e) => e.workerId === worker.id)
      .reduce((a, e) => a + e.hours, 0);
    const capacityHours = worker.monthlyCapacityHours * 12;
    const utilization =
      capacityHours > 0
        ? Math.round((totalHours / capacityHours) * 1000) / 10
        : 0;
    return { worker, totalHours, capacityHours, utilization };
  });
}

export type Totals = {
  totalHours: number;
  totalCapacity: number;
  utilization: number; // %
  activeProjects: number;
};

export function orgTotals(
  entries: Entry[],
  workers: Worker[],
  projects: Project[],
  year: number
): Totals {
  const yEntries = filterByYear(entries, year);
  const totalHours = yEntries.reduce((a, e) => a + e.hours, 0);
  const totalCapacity = workers.reduce(
    (a, w) => a + w.monthlyCapacityHours * 12,
    0
  );
  const activeProjects = projects.filter((p) =>
    yEntries.some((e) => e.projectId === p.id && e.hours > 0)
  ).length;
  return {
    totalHours,
    totalCapacity,
    utilization:
      totalCapacity > 0
        ? Math.round((totalHours / totalCapacity) * 1000) / 10
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
