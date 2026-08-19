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

  it("task の開始年と実績の年がずれていても、そのサブツリーの実績として拾う", () => {
    // t3 は 2026年に開始する task だが、その実績は 2027年分として記録されている
    // (task_entries が year/month を独立に持つのは、月をまたぐ task の実績を
    // 実測で年ごとに分けられるようにするため。これは異常な入力ではない)。
    const crossYearTask: Task = {
      id: "t3",
      trackerPjId: "葉1",
      assigneeId: "w1",
      title: "t3",
      startAt: "2026-12-20T10:00:00+09:00",
      endAt: "2026-12-20T12:00:00+09:00",
    };
    const crossYearEntry: TaskEntry = {
      id: "e4",
      taskId: "t3",
      year: 2027,
      month: 1,
      hours: 5,
    };
    const tasks = [...TASKS, crossYearTask];
    const entries = [...ENTRIES, crossYearEntry];

    const [row] = contractProgress(entries, tasks, PJS, 2027);
    expect(row.actualHours).toBe(5);
  });

  it("この1本のツリー（契約ノードが1つだけ全体を覆う）に限れば、actualHours 合計は orgTotals.totalHours と一致する（一般には保証されない不変条件ではない。下記2件を参照）", () => {
    const crossYearTask: Task = {
      id: "t3",
      trackerPjId: "葉1",
      assigneeId: "w1",
      title: "t3",
      startAt: "2026-12-20T10:00:00+09:00",
      endAt: "2026-12-20T12:00:00+09:00",
    };
    const crossYearEntry: TaskEntry = {
      id: "e4",
      taskId: "t3",
      year: 2027,
      month: 1,
      hours: 5,
    };
    const tasks = [...TASKS, crossYearTask];
    const entries = [...ENTRIES, crossYearEntry];

    const rows = contractProgress(entries, tasks, PJS, 2027);
    const sumActual = rows.reduce((a, r) => a + r.actualHours, 0);
    const totals = orgTotals(entries, tasks, PJS, TRACKERS, 2027);
    expect(sumActual).toBe(totals.totalHours);
  });

  it("契約ノードが1つも無いツリーでは undercount する: orgTotals は実績を数えるが contractProgress は空になる", () => {
    // fiscalYear / budgetAmount のどちらも持たない木。/pj からはこの形が作れる。
    const noContractPjs: Pj[] = [
      { id: "root", name: "root", color: "#000" },
      { id: "leaf", parentId: "root", name: "leaf", color: "#111" },
    ];
    const noContractTrackers: Tracker[] = [{ pjId: "leaf" }];
    const noContractTasks: Task[] = [
      {
        id: "nt1",
        trackerPjId: "leaf",
        assigneeId: "w1",
        title: "nt1",
        startAt: "2026-02-10T10:00:00+09:00",
        endAt: "2026-02-10T18:00:00+09:00",
      },
    ];
    const noContractEntries: TaskEntry[] = [
      { id: "ne1", taskId: "nt1", year: 2026, month: 2, hours: 4 },
    ];

    const progress = contractProgress(
      noContractEntries,
      noContractTasks,
      noContractPjs,
      2026
    );
    expect(progress).toEqual([]);

    const totals = orgTotals(
      noContractEntries,
      noContractTasks,
      noContractPjs,
      noContractTrackers,
      2026
    );
    expect(totals.totalHours).toBe(4);
  });

  it("契約ノードが入れ子だと overcount する: 内側の実績が外側・内側の両方の行で数えられる", () => {
    // 顧客側にも受注側にも fiscalYear を入れると、内側の契約ノードのぶんが
    // 二重に数えられる。何もこれを禁止していない。
    const nestedPjs: Pj[] = [
      { id: "outer", name: "outer", color: "#000", fiscalYear: 2026 },
      {
        id: "inner",
        parentId: "outer",
        name: "inner",
        color: "#000",
        fiscalYear: 2026,
      },
      { id: "leaf", parentId: "inner", name: "leaf", color: "#111" },
    ];
    const nestedTrackers: Tracker[] = [{ pjId: "leaf" }];
    const nestedTasks: Task[] = [
      {
        id: "nx1",
        trackerPjId: "leaf",
        assigneeId: "w1",
        title: "nx1",
        startAt: "2026-02-10T10:00:00+09:00",
        endAt: "2026-02-10T18:00:00+09:00",
      },
    ];
    const nestedEntries: TaskEntry[] = [
      { id: "nxe1", taskId: "nx1", year: 2026, month: 2, hours: 5 },
    ];

    const rows = contractProgress(nestedEntries, nestedTasks, nestedPjs, 2026);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.pj.id === "outer")?.actualHours).toBe(5);
    expect(rows.find((r) => r.pj.id === "inner")?.actualHours).toBe(5);

    const sumActual = rows.reduce((a, r) => a + r.actualHours, 0);
    const totals = orgTotals(
      nestedEntries,
      nestedTasks,
      nestedPjs,
      nestedTrackers,
      2026
    );
    // 列の合計(10)は org 全体の実績(5)を上回る = 「合計とその内訳」としては読めない。
    expect(sumActual).toBe(10);
    expect(totals.totalHours).toBe(5);
    expect(sumActual).toBeGreaterThan(totals.totalHours);
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
