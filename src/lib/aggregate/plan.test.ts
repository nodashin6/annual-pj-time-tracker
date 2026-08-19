import { describe, it, expect } from "vitest";
import type { Task } from "../types";
import { plannedHoursOf, sumPlannedHours, tasksInYear } from "./plan";

const task = (startAt: string, endAt: string, id = "t"): Task => ({
  id,
  trackerPjId: "p",
  assigneeId: "w",
  title: id,
  startAt,
  endAt,
});

describe("plannedHoursOf", () => {
  it("同日内の枠の長さを時間で返す", () => {
    expect(
      plannedHoursOf(
        task("2026-02-10T10:00:00+09:00", "2026-02-10T18:00:00+09:00")
      )
    ).toBe(8);
  });

  it("分単位の端数を保つ", () => {
    expect(
      plannedHoursOf(
        task("2026-02-10T10:00:00+09:00", "2026-02-10T10:30:00+09:00")
      )
    ).toBe(0.5);
  });

  it("日をまたぐ枠は経過時間そのままを返す（夜間も数える）", () => {
    expect(
      plannedHoursOf(
        task("2026-02-10T22:00:00+09:00", "2026-02-11T02:00:00+09:00")
      )
    ).toBe(4);
  });

  it("タイムゾーン表記が違っても同じ瞬間なら同じ値になる", () => {
    expect(
      plannedHoursOf(task("2026-02-10T01:00:00Z", "2026-02-10T10:00:00+09:00"))
    ).toBe(0);
  });

  it("パースできない日時は 0 を返す", () => {
    expect(plannedHoursOf(task("きのう", "きょう"))).toBe(0);
  });
});

describe("sumPlannedHours", () => {
  it("合計する", () => {
    const ts = [
      task("2026-02-10T10:00:00+09:00", "2026-02-10T18:00:00+09:00", "a"),
      task("2026-02-11T10:00:00+09:00", "2026-02-11T12:00:00+09:00", "b"),
    ];
    expect(sumPlannedHours(ts)).toBe(10);
  });

  it("空配列は 0", () => {
    expect(sumPlannedHours([])).toBe(0);
  });
});

describe("tasksInYear", () => {
  it("開始日時の年で絞る", () => {
    const ts = [
      task("2026-02-10T10:00:00+09:00", "2026-02-10T18:00:00+09:00", "a"),
      task("2027-02-10T10:00:00+09:00", "2027-02-10T18:00:00+09:00", "b"),
    ];
    expect(tasksInYear(ts, 2026).map((t) => t.id)).toEqual(["a"]);
  });
});
