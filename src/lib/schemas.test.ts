import { describe, it, expect } from "vitest";
import {
  validate,
  pjInputSchema,
  pjPatchSchema,
  trackerInputSchema,
  issueInputSchema,
  taskInputSchema,
  taskPatchSchema,
  taskEntryInputSchema,
  workerInputSchema,
} from "./schemas";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("workerInputSchema", () => {
  it("前後の空白を除去する", () => {
    const r = validate(workerInputSchema, { name: "  佐藤  " });
    expect(r.ok && r.data.name).toBe("佐藤");
  });

  it("空文字を弾く", () => {
    const r = validate(workerInputSchema, { name: "   " });
    expect(r.ok).toBe(false);
  });
});

describe("pjInputSchema", () => {
  it("名前だけで通る（親なしルートノード）", () => {
    const r = validate(pjInputSchema, { name: "A社" });
    expect(r.ok).toBe(true);
  });

  it("parentId は uuid でなければ弾く", () => {
    const r = validate(pjInputSchema, { name: "受注", parentId: "abc" });
    expect(r.ok).toBe(false);
  });

  it("color は #RRGGBB でなければ弾く", () => {
    const r = validate(pjInputSchema, { name: "受注", color: "red" });
    expect(r.ok).toBe(false);
  });

  it("budgetAmount は負数を弾く", () => {
    const r = validate(pjInputSchema, { name: "受注", budgetAmount: -1 });
    expect(r.ok).toBe(false);
  });

  it("patch は部分適用できる", () => {
    const r = validate(pjPatchSchema, { name: "改名だけ" });
    expect(r.ok).toBe(true);
  });
});

describe("trackerInputSchema", () => {
  it("開始 <= 終了 なら通る", () => {
    const r = validate(trackerInputSchema, {
      pjId: UUID,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(r.ok).toBe(true);
  });

  it("開始 > 終了 を弾く", () => {
    const r = validate(trackerInputSchema, {
      pjId: UUID,
      startDate: "2026-12-31",
      endDate: "2026-01-01",
    });
    expect(r.ok).toBe(false);
  });

  it("日付なしでも通る（期間未定の葉）", () => {
    const r = validate(trackerInputSchema, { pjId: UUID });
    expect(r.ok).toBe(true);
  });
});

describe("issueInputSchema", () => {
  it("担当者なしで通る（宙ぶらりん可）", () => {
    const r = validate(issueInputSchema, {
      trackerPjId: UUID,
      title: "カート離脱率の改善",
    });
    expect(r.ok && r.data.status).toBe("open");
  });

  it("未知の status を弾く", () => {
    const r = validate(issueInputSchema, {
      trackerPjId: UUID,
      title: "x",
      status: "wontfix",
    });
    expect(r.ok).toBe(false);
  });
});

describe("taskInputSchema", () => {
  const base = {
    trackerPjId: UUID,
    assigneeId: UUID2,
    title: "IdP 比較検討",
    startAt: "2026-02-10T10:00:00+09:00",
    endAt: "2026-02-10T18:00:00+09:00",
  };

  it("担当者と期間が揃えば通る", () => {
    expect(validate(taskInputSchema, base).ok).toBe(true);
  });

  it("担当者なしを弾く（必須1名）", () => {
    expect(
      validate(taskInputSchema, { ...base, assigneeId: undefined }).ok
    ).toBe(false);
  });

  it("開始 >= 終了 を弾く", () => {
    const r = validate(taskInputSchema, { ...base, endAt: base.startAt });
    expect(r.ok).toBe(false);
  });

  it("パースできない日時を弾く", () => {
    const r = validate(taskInputSchema, { ...base, startAt: "きのう" });
    expect(r.ok).toBe(false);
  });

  it("patch は部分適用できる", () => {
    expect(validate(taskPatchSchema, { title: "改題" }).ok).toBe(true);
  });
});

describe("taskEntryInputSchema", () => {
  it("1-12 月のみ通す", () => {
    const ok = validate(taskEntryInputSchema, {
      taskId: UUID,
      year: 2026,
      month: 12,
      hours: 8,
    });
    expect(ok.ok).toBe(true);

    const ng = validate(taskEntryInputSchema, {
      taskId: UUID,
      year: 2026,
      month: 13,
      hours: 8,
    });
    expect(ng.ok).toBe(false);
  });

  it("負の工数を弾く", () => {
    const r = validate(taskEntryInputSchema, {
      taskId: UUID,
      year: 2026,
      month: 1,
      hours: -1,
    });
    expect(r.ok).toBe(false);
  });
});
