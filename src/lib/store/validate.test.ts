import { describe, it, expect } from "vitest";
import { mergeTrackerDates, mergeTaskDates } from "./validate";
import { TRACKER_ORDER_MESSAGE, TASK_ORDER_MESSAGE } from "../schemas";

describe("mergeTrackerDates", () => {
  const current = { startDate: "2026-04-01", endDate: "2026-09-30" };

  it("終了日だけの patch が現在の開始日より前なら reject する", () => {
    const r = mergeTrackerDates(current, { endDate: "2026-01-01" });
    expect(r).toEqual({ ok: false, message: TRACKER_ORDER_MESSAGE });
  });

  it("開始日だけの patch が現在の終了日より後なら reject する", () => {
    const r = mergeTrackerDates(current, { startDate: "2026-12-01" });
    expect(r).toEqual({ ok: false, message: TRACKER_ORDER_MESSAGE });
  });

  it("両端点とも patch に無い場合（タイトルのみ相当の編集）は誤って reject しない", () => {
    const r = mergeTrackerDates(current, {});
    expect(r).toEqual({
      ok: true,
      start: current.startDate,
      end: current.endDate,
    });
  });

  it("開始日 == 終了日 は許容する（同日の tracker があり得るため）", () => {
    const r = mergeTrackerDates(current, {
      startDate: "2026-05-01",
      endDate: "2026-05-01",
    });
    expect(r.ok).toBe(true);
  });

  it("current が無い（新規相当）場合、片方だけの patch では検証しない", () => {
    const r = mergeTrackerDates(undefined, { startDate: "2026-05-01" });
    expect(r).toEqual({ ok: true, start: "2026-05-01", end: undefined });
  });

  it("endDate: undefined は明示的なクリアとして扱い、開始日のみ残る", () => {
    const r = mergeTrackerDates(current, { endDate: undefined });
    expect(r).toEqual({
      ok: true,
      start: current.startDate,
      end: undefined,
    });
  });
});

describe("mergeTaskDates", () => {
  const current = {
    startAt: "2026-04-01T10:00:00.000Z",
    endAt: "2026-04-01T18:00:00.000Z",
  };

  it("終了時刻だけの patch が現在の開始時刻より前なら reject する", () => {
    const r = mergeTaskDates(current, { endAt: "2026-01-01T00:00:00.000Z" });
    expect(r).toEqual({ ok: false, message: TASK_ORDER_MESSAGE });
  });

  it("開始時刻だけの patch が現在の終了時刻より後なら reject する", () => {
    const r = mergeTaskDates(current, { startAt: "2026-12-01T00:00:00.000Z" });
    expect(r).toEqual({ ok: false, message: TASK_ORDER_MESSAGE });
  });

  it("両端点とも patch に無い場合（タイトルのみの編集）は誤って reject しない", () => {
    const r = mergeTaskDates(current, {});
    expect(r).toEqual({
      ok: true,
      start: current.startAt,
      end: current.endAt,
    });
  });

  it("開始 == 終了 は reject する（task は正の長さの枠が必須のため）", () => {
    const r = mergeTaskDates(current, {
      startAt: "2026-04-01T10:00:00.000Z",
      endAt: "2026-04-01T10:00:00.000Z",
    });
    expect(r).toEqual({ ok: false, message: TASK_ORDER_MESSAGE });
  });

  it("開始 < 終了 なら受理する", () => {
    const r = mergeTaskDates(current, {
      startAt: "2026-04-01T09:00:00.000Z",
      endAt: "2026-04-01T09:30:00.000Z",
    });
    expect(r.ok).toBe(true);
  });
});
