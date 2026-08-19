import { describe, it, expect } from "vitest";
import type { Task } from "../types";
import {
  plannedHoursOf,
  sumPlannedHours,
  tasksInYear,
  overlapsMonth,
} from "./plan";

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

describe("overlapsMonth", () => {
  // overlapsMonth は月の境界を「実行環境のローカル時刻」で作る（利用者のカレンダー基準）。
  // そのためフィクスチャも固定オフセットではなくローカル時刻で組み立てる。
  // +09:00 のような固定オフセットで書くと、UTC の CI と JST の手元で結果が変わる。
  const localIso = (y: number, m: number, d: number, h = 0, min = 0): string =>
    new Date(y, m - 1, d, h, min).toISOString();

  const span = (s: string, e: string): Task => task(s, e, "t");

  it("単日の task はその月だけ重なる", () => {
    const t = span(localIso(2026, 4, 20, 10), localIso(2026, 4, 20, 18));
    expect(overlapsMonth(t, 2026, 3)).toBe(false);
    expect(overlapsMonth(t, 2026, 4)).toBe(true);
    expect(overlapsMonth(t, 2026, 5)).toBe(false);
  });

  it("月をまたぐ task は両方の月に重なる", () => {
    const t = span(localIso(2026, 3, 25, 10), localIso(2026, 4, 5, 18));
    expect(overlapsMonth(t, 2026, 3)).toBe(true);
    expect(overlapsMonth(t, 2026, 4)).toBe(true);
  });

  it("月末23:59に終わる task はその月に重なる", () => {
    const t = span(localIso(2026, 4, 30, 9), localIso(2026, 4, 30, 23, 59));
    expect(overlapsMonth(t, 2026, 4)).toBe(true);
    expect(overlapsMonth(t, 2026, 5)).toBe(false);
  });

  it("翌月1日0時ちょうどに終わる task は翌月に重ならない（半開区間）", () => {
    const t = span(localIso(2026, 3, 25, 10), localIso(2026, 4, 1, 0));
    expect(overlapsMonth(t, 2026, 3)).toBe(true);
    expect(overlapsMonth(t, 2026, 4)).toBe(false);
  });

  it("月初0時ちょうどに始まる task はその月に重なる", () => {
    const t = span(localIso(2026, 4, 1, 0), localIso(2026, 4, 1, 9));
    expect(overlapsMonth(t, 2026, 3)).toBe(false);
    expect(overlapsMonth(t, 2026, 4)).toBe(true);
  });

  it("パースできない日時は重ならない扱い", () => {
    expect(overlapsMonth(span("きのう", "きょう"), 2026, 4)).toBe(false);
  });
});
