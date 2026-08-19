import { describe, it, expect } from "vitest";
import type { Pj, Task, TaskEntry, Tracker, Worker } from "../types";
import {
  filterByYear,
  availableYears,
  monthlyStackByLeaf,
  annualByLeaf,
  workerHours,
  contractProgress,
  orgTotals,
} from "./progress";

//  受注(契約) ─ サブ ─ 葉1
//                └──── 葉2
const PJS: Pj[] = [
  {
    id: "受注",
    name: "受注",
    color: "#000",
    fiscalYear: 2026,
    budgetAmount: 100,
  },
  { id: "サブ", parentId: "受注", name: "サブ", color: "#000" },
  { id: "葉1", parentId: "サブ", name: "葉1", color: "#111" },
  { id: "葉2", parentId: "サブ", name: "葉2", color: "#222" },
];
const TRACKERS: Tracker[] = [{ pjId: "葉1" }, { pjId: "葉2" }];
const LEAVES = PJS.filter((p) => p.id === "葉1" || p.id === "葉2");

const WORKERS: Worker[] = [
  { id: "w1", name: "佐藤" },
  { id: "w2", name: "鈴木" },
];

// 葉1: 8h 枠 (w1) / 葉2: 2h 枠 (w2)
const TASKS: Task[] = [
  {
    id: "t1",
    trackerPjId: "葉1",
    assigneeId: "w1",
    title: "t1",
    startAt: "2026-02-10T10:00:00+09:00",
    endAt: "2026-02-10T18:00:00+09:00",
  },
  {
    id: "t2",
    trackerPjId: "葉2",
    assigneeId: "w2",
    title: "t2",
    startAt: "2026-03-05T10:00:00+09:00",
    endAt: "2026-03-05T12:00:00+09:00",
  },
];

const ENTRIES: TaskEntry[] = [
  { id: "e1", taskId: "t1", year: 2026, month: 2, hours: 6 },
  { id: "e2", taskId: "t2", year: 2026, month: 3, hours: 3 },
  { id: "e3", taskId: "t1", year: 2025, month: 12, hours: 99 },
];

describe("filterByYear", () => {
  it("指定年だけ残す", () => {
    expect(filterByYear(ENTRIES, 2026).map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});

describe("availableYears", () => {
  it("実績と task の年の和集合を降順で返す", () => {
    expect(availableYears(ENTRIES, TASKS, 2028)).toEqual([2028, 2026, 2025]);
  });

  it("現在年が既にあっても重複しない", () => {
    expect(availableYears(ENTRIES, TASKS, 2026)).toEqual([2026, 2025]);
  });
});

describe("monthlyStackByLeaf", () => {
  it("task 経由で葉pjへ寄せて12ヶ月ぶん返す", () => {
    const rows = monthlyStackByLeaf(ENTRIES, TASKS, LEAVES, 2026);
    expect(rows).toHaveLength(12);
    expect(rows[1]).toMatchObject({ month: "2月", 葉1: 6, 葉2: 0, total: 6 });
    expect(rows[2]).toMatchObject({ month: "3月", 葉1: 0, 葉2: 3, total: 3 });
  });
});

describe("annualByLeaf", () => {
  it("葉別の年間合計を降順で返す", () => {
    const rows = annualByLeaf(ENTRIES, TASKS, LEAVES, 2026);
    expect(rows.map((r) => [r.pj.id, r.hours])).toEqual([
      ["葉1", 6],
      ["葉2", 3],
    ]);
  });
});

describe("workerHours", () => {
  it("task.assigneeId 経由でワーカーに寄せる", () => {
    expect(workerHours(ENTRIES, TASKS, WORKERS, 2026)).toEqual([
      { worker: WORKERS[0], totalHours: 6 },
      { worker: WORKERS[1], totalHours: 3 },
    ]);
  });
});

describe("contractProgress", () => {
  it("契約ノードのサブツリー配下 task の予定と実績を集計する", () => {
    const [row] = contractProgress(ENTRIES, TASKS, PJS, 2026);
    expect(row.pj.id).toBe("受注");
    expect(row.plannedHours).toBe(10); // 8h + 2h
    expect(row.actualHours).toBe(9); // 6h + 3h
    expect(row.consumption).toBe(90);
  });

  it("task が無ければ予定 0・消化率 0 で落ちない", () => {
    const [row] = contractProgress([], [], PJS, 2026);
    expect(row.plannedHours).toBe(0);
    expect(row.consumption).toBe(0);
  });
});

describe("orgTotals", () => {
  it("全体の実績・予定・消化率・稼働葉数を返す", () => {
    const t = orgTotals(ENTRIES, TASKS, PJS, TRACKERS, 2026);
    expect(t.totalHours).toBe(9);
    expect(t.totalPlanned).toBe(10);
    expect(t.consumption).toBe(90);
    expect(t.activeLeaves).toBe(2);
  });

  it("予定 0 のとき消化率は 0（ゼロ除算しない）", () => {
    const t = orgTotals([], [], PJS, TRACKERS, 2026);
    expect(t.consumption).toBe(0);
    expect(t.activeLeaves).toBe(0);
  });
});
