import { describe, it, expect } from "vitest";
import { toPj, toTracker, toIssue, toTask, toTaskEntry } from "./mappers";

describe("toPj", () => {
  it("null を undefined に、numeric 文字列を数値に変換する", () => {
    const pj = toPj({
      id: "p1",
      parent_id: null,
      name: "A社",
      color: "#000000",
      owner_worker_id: null,
      fiscal_year: null,
      budget_amount: "1000.50",
    });
    expect(pj).toEqual({
      id: "p1",
      parentId: undefined,
      name: "A社",
      color: "#000000",
      ownerWorkerId: undefined,
      fiscalYear: undefined,
      budgetAmount: 1000.5,
    });
  });

  it("budget_amount が 0 のとき undefined にしない", () => {
    const pj = toPj({
      id: "p1",
      parent_id: null,
      name: "x",
      color: "#000000",
      owner_worker_id: null,
      fiscal_year: null,
      budget_amount: 0,
    });
    expect(pj.budgetAmount).toBe(0);
  });
});

describe("toTracker", () => {
  it("日付 null を undefined にする", () => {
    expect(
      toTracker({ pj_id: "p1", start_date: null, end_date: null })
    ).toEqual({
      pjId: "p1",
      startDate: undefined,
      endDate: undefined,
    });
  });
});

describe("toIssue", () => {
  it("担当者 null を undefined にする（宙ぶらりん）", () => {
    const issue = toIssue({
      id: "i1",
      tracker_pj_id: "p1",
      parent_id: null,
      assignee_id: null,
      title: "改善",
      due_date: null,
      status: "open",
    });
    expect(issue.assigneeId).toBeUndefined();
    expect(issue.status).toBe("open");
  });

  it("未知の status は open に丸める", () => {
    const issue = toIssue({
      id: "i1",
      tracker_pj_id: "p1",
      parent_id: null,
      assignee_id: null,
      title: "改善",
      due_date: null,
      status: "wontfix",
    });
    expect(issue.status).toBe("open");
  });
});

describe("toTask", () => {
  it("issue_id null を undefined にする", () => {
    const task = toTask({
      id: "t1",
      tracker_pj_id: "p1",
      issue_id: null,
      assignee_id: "w1",
      title: "作業",
      start_at: "2026-02-10T01:00:00Z",
      end_at: "2026-02-10T09:00:00Z",
    });
    expect(task.issueId).toBeUndefined();
    expect(task.assigneeId).toBe("w1");
  });
});

describe("toTaskEntry", () => {
  it("numeric 文字列の工数を数値にする", () => {
    const e = toTaskEntry({
      id: "e1",
      task_id: "t1",
      year: 2026,
      month: 2,
      hours: "6.5",
    });
    expect(e.hours).toBe(6.5);
  });
});
