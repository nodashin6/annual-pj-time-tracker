import { describe, it, expect } from "vitest";
import {
  validate,
  workerInputSchema,
  orderInputSchema,
  projectInputSchema,
  entryInputSchema,
} from "./schemas";

describe("validate + workerInputSchema", () => {
  it("有効な名前を通し、trim する", () => {
    const r = validate(workerInputSchema, { name: "  佐藤 太郎  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.name).toBe("佐藤 太郎");
  });
  it("空名は弾く", () => {
    const r = validate(workerInputSchema, { name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("名称");
  });
  it("長すぎる名前は弾く", () => {
    const r = validate(workerInputSchema, { name: "あ".repeat(121) });
    expect(r.ok).toBe(false);
  });
});

describe("orderInputSchema", () => {
  it("最小構成（name + 工数）を通す", () => {
    const r = validate(orderInputSchema, {
      name: "受注A",
      initialHours: 100,
      plannedHours: 120,
    });
    expect(r.ok).toBe(true);
  });
  it("負の工数を弾く", () => {
    const r = validate(orderInputSchema, {
      name: "受注A",
      initialHours: -1,
      plannedHours: 0,
    });
    expect(r.ok).toBe(false);
  });
  it("不正な clientId(uuid でない) を弾く", () => {
    const r = validate(orderInputSchema, {
      name: "受注A",
      clientId: "not-a-uuid",
      initialHours: 0,
      plannedHours: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe("projectInputSchema", () => {
  const orderId = "11111111-1111-1111-1111-111111111111";
  it("有効なプロジェクトを通す", () => {
    const r = validate(projectInputSchema, {
      name: "PJ",
      orderId,
      color: "#6366f1",
      initialHours: 10,
      plannedHours: 20,
    });
    expect(r.ok).toBe(true);
  });
  it("空 color を許容する（自動採番用）", () => {
    const r = validate(projectInputSchema, {
      name: "PJ",
      orderId,
      color: "",
      initialHours: 0,
      plannedHours: 0,
    });
    expect(r.ok).toBe(true);
  });
  it("不正な color 形式を弾く", () => {
    const r = validate(projectInputSchema, {
      name: "PJ",
      orderId,
      color: "red",
      initialHours: 0,
      plannedHours: 0,
    });
    expect(r.ok).toBe(false);
  });
  it("orderId 未指定を弾く", () => {
    const r = validate(projectInputSchema, {
      name: "PJ",
      initialHours: 0,
      plannedHours: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe("entryInputSchema", () => {
  const ids = {
    workerId: "11111111-1111-1111-1111-111111111111",
    projectId: "22222222-2222-2222-2222-222222222222",
  };
  it("有効なエントリを通す", () => {
    const r = validate(entryInputSchema, {
      ...ids,
      year: 2026,
      month: 6,
      hours: 40,
    });
    expect(r.ok).toBe(true);
  });
  it("month 範囲外を弾く", () => {
    const r = validate(entryInputSchema, {
      ...ids,
      year: 2026,
      month: 13,
      hours: 40,
    });
    expect(r.ok).toBe(false);
  });
  it("hours 0 を許容する（削除相当）", () => {
    const r = validate(entryInputSchema, {
      ...ids,
      year: 2026,
      month: 6,
      hours: 0,
    });
    expect(r.ok).toBe(true);
  });
});

describe("partial スキーマ（update 用）", () => {
  it("一部フィールドのみでも検証を通す", () => {
    const r = validate(orderInputSchema.partial(), { plannedHours: 50 });
    expect(r.ok).toBe(true);
  });
  it("partial でも不正値は弾く", () => {
    const r = validate(orderInputSchema.partial(), { plannedHours: -5 });
    expect(r.ok).toBe(false);
  });
});
