import { describe, it, expect } from "vitest";
import {
  filterByYear,
  monthlyStackByProject,
  annualByProject,
  workerHours,
  orderProgress,
  orgTotals,
  availableYears,
} from "./aggregate";
import type { Worker, Project, Order, Entry } from "./types";

const worker = (id: string, name = id): Worker => ({ id, name });
const project = (
  id: string,
  orderId: string,
  over: Partial<Project> = {}
): Project => ({
  id,
  orderId,
  name: id,
  color: "#000000",
  initialHours: 0,
  plannedHours: 0,
  ...over,
});
const order = (id: string, over: Partial<Order> = {}): Order => ({
  id,
  name: id,
  initialHours: 0,
  plannedHours: 0,
  ...over,
});
const entry = (
  workerId: string,
  projectId: string,
  year: number,
  month: number,
  hours: number
): Entry => ({
  id: `${workerId}-${projectId}-${year}-${month}`,
  workerId,
  projectId,
  year,
  month,
  hours,
});

describe("filterByYear", () => {
  it("指定年のみ返す", () => {
    const entries = [
      entry("w1", "p1", 2025, 1, 5),
      entry("w1", "p1", 2026, 1, 8),
    ];
    expect(filterByYear(entries, 2026)).toHaveLength(1);
    expect(filterByYear(entries, 2026)[0].hours).toBe(8);
  });
  it("該当なしなら空配列", () => {
    expect(filterByYear([], 2026)).toEqual([]);
  });
});

describe("monthlyStackByProject", () => {
  it("12 か月分の行を返し、月別にプロジェクト工数を集計する", () => {
    const projects = [project("p1", "o1"), project("p2", "o1")];
    const entries = [
      entry("w1", "p1", 2026, 1, 10),
      entry("w2", "p1", 2026, 1, 5),
      entry("w1", "p2", 2026, 1, 3),
      entry("w1", "p1", 2026, 2, 7),
    ];
    const rows = monthlyStackByProject(entries, projects, 2026);
    expect(rows).toHaveLength(12);
    expect(rows[0].p1).toBe(15);
    expect(rows[0].p2).toBe(3);
    expect(rows[0].total).toBe(18);
    expect(rows[1].p1).toBe(7);
    expect(rows[1].total).toBe(7);
  });
  it("別年のエントリは無視する", () => {
    const projects = [project("p1", "o1")];
    const rows = monthlyStackByProject(
      [entry("w1", "p1", 2025, 1, 99)],
      projects,
      2026
    );
    expect(rows[0].p1).toBe(0);
  });
});

describe("annualByProject", () => {
  it("工数降順でソートして返す", () => {
    const projects = [project("p1", "o1"), project("p2", "o1")];
    const entries = [
      entry("w1", "p1", 2026, 1, 10),
      entry("w1", "p2", 2026, 1, 40),
    ];
    const result = annualByProject(entries, projects, 2026);
    expect(result[0].project.id).toBe("p2");
    expect(result[0].hours).toBe(40);
    expect(result[1].hours).toBe(10);
  });
});

describe("workerHours", () => {
  it("ワーカー別の合計を降順で返す", () => {
    const workers = [worker("w1"), worker("w2")];
    const entries = [
      entry("w1", "p1", 2026, 1, 10),
      entry("w2", "p1", 2026, 1, 30),
      entry("w2", "p2", 2026, 2, 5),
    ];
    const result = workerHours(entries, workers, 2026);
    expect(result[0].worker.id).toBe("w2");
    expect(result[0].totalHours).toBe(35);
    expect(result[1].totalHours).toBe(10);
  });
});

describe("orderProgress", () => {
  it("受注配下 PJ の実績合計と消化率を算出する", () => {
    const orders = [order("o1", { plannedHours: 100, initialHours: 80 })];
    const projects = [project("p1", "o1"), project("p2", "o1")];
    const entries = [
      entry("w1", "p1", 2026, 1, 30),
      entry("w1", "p2", 2026, 1, 20),
    ];
    const [prog] = orderProgress(entries, orders, projects, 2026);
    expect(prog.actualHours).toBe(50);
    expect(prog.plannedHours).toBe(100);
    expect(prog.consumption).toBe(50);
  });
  it("予定 0 の場合は消化率 0（ゼロ除算しない）", () => {
    const orders = [order("o1", { plannedHours: 0 })];
    const projects = [project("p1", "o1")];
    const [prog] = orderProgress(
      [entry("w1", "p1", 2026, 1, 10)],
      orders,
      projects,
      2026
    );
    expect(prog.consumption).toBe(0);
  });
  it("消化率は小数第一位に丸める", () => {
    const orders = [order("o1", { plannedHours: 3 })];
    const projects = [project("p1", "o1")];
    const [prog] = orderProgress(
      [entry("w1", "p1", 2026, 1, 1)],
      orders,
      projects,
      2026
    );
    expect(prog.consumption).toBe(33.3);
  });
});

describe("orgTotals", () => {
  it("全体の実績・予定・消化率・稼働 PJ 数を算出する", () => {
    const orders = [
      order("o1", { plannedHours: 100 }),
      order("o2", { plannedHours: 50 }),
    ];
    const projects = [project("p1", "o1"), project("p2", "o2")];
    const entries = [
      entry("w1", "p1", 2026, 1, 60),
      entry("w1", "p2", 2026, 1, 15),
    ];
    const totals = orgTotals(entries, orders, projects, 2026);
    expect(totals.totalHours).toBe(75);
    expect(totals.totalPlanned).toBe(150);
    expect(totals.consumption).toBe(50);
    expect(totals.activeProjects).toBe(2);
  });
  it("hours 0 の PJ は稼働 PJ に数えない", () => {
    const orders = [order("o1", { plannedHours: 10 })];
    const projects = [project("p1", "o1")];
    const totals = orgTotals(
      [entry("w1", "p1", 2026, 1, 0)],
      orders,
      projects,
      2026
    );
    expect(totals.activeProjects).toBe(0);
  });
});

describe("availableYears", () => {
  it("エントリの年 + current を降順・重複排除で返す", () => {
    const entries = [
      entry("w1", "p1", 2024, 1, 1),
      entry("w1", "p1", 2026, 1, 1),
      entry("w1", "p1", 2024, 2, 1),
    ];
    expect(availableYears(entries, 2025)).toEqual([2026, 2025, 2024]);
  });
});
