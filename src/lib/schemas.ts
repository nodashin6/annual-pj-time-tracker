/**
 * ドメイン入力のバリデーションスキーマ（Zod）。
 *
 * フォーム/ストアの書き込み前にここで検証し、不正なデータが Supabase に
 * 到達するのを防ぐ。UI 表示型（types.ts）とは別に「入力（create/update）」の
 * 制約を集約する単一の真実の源。
 *
 * refine 付きのスキーマには .partial() が使えないため、
 * update 用には base.partial() から作った *PatchSchema を別に出す。
 */
import { z } from "zod";
import { ISSUE_STATUSES } from "./types";

const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 名称: 前後空白を除去して 1〜120 文字。 */
const name = z
  .string()
  .trim()
  .min(1, "名称を入力してください")
  .max(120, "名称は120文字以内で入力してください");

/** 工数（時間）: 0 以上。 */
const hours = z
  .number({ invalid_type_error: "数値を入力してください" })
  .finite("有効な数値を入力してください")
  .min(0, "工数は0以上で入力してください")
  .max(100000, "工数が大きすぎます");

/** 金額: 0 以上。 */
const amount = z
  .number({ invalid_type_error: "数値を入力してください" })
  .finite()
  .min(0, "金額は0以上で入力してください");

/** 会計年度 / 実績の年。 */
const year = z
  .number()
  .int("年度は整数で入力してください")
  .min(1970, "年度が範囲外です")
  .max(2999, "年度が範囲外です");

const isoDate = z
  .string()
  .regex(ISO_DATE, "日付は YYYY-MM-DD 形式で指定してください");

/** ISO8601 の日時。Date.parse できることまで見る。 */
const isoDateTime = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "日時の形式が不正です");

const color = z
  .string()
  .regex(HEX_COLOR, "カラーは #RRGGBB 形式で指定してください")
  .optional()
  .or(z.literal(""));

// ---- マスタ ----
export const workerInputSchema = z.object({ name });

// ---- pj（再帰ツリー） ----
const pjInputBase = z.object({
  name,
  parentId: z.string().uuid().optional(),
  color,
  ownerWorkerId: z.string().uuid().optional(),
  fiscalYear: year.optional(),
  budgetAmount: amount.optional(),
});
export const pjInputSchema = pjInputBase;
export const pjPatchSchema = pjInputBase.partial();

/**
 * tracker の期間順序エラーメッセージ。
 * `trackerPatchSchema` は `.partial()` で refine が落ちるため、
 * store 側（updateTracker）でマージ後の値を使って同じ検証を再現する。
 * メッセージはここを唯一の真実の源にして両方から参照する。
 */
export const TRACKER_ORDER_MESSAGE = "終了日は開始日以降にしてください";

// ---- tracker（葉の印 + 期間） ----
const trackerInputBase = z.object({
  pjId: z.string().uuid(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});
export const trackerInputSchema = trackerInputBase.refine(
  (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
  { message: TRACKER_ORDER_MESSAGE, path: ["endDate"] }
);
export const trackerPatchSchema = trackerInputBase.partial();

// ---- issue（GitHub issue 相当） ----
const issueInputBase = z.object({
  trackerPjId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  title: name,
  dueDate: isoDate.optional(),
  status: z.enum(ISSUE_STATUSES).default("open"),
});
export const issueInputSchema = issueInputBase;
export const issuePatchSchema = issueInputBase.partial();

/**
 * task の期間順序エラーメッセージ。
 * `taskPatchSchema` は `.partial()` で refine が落ちるため、
 * store 側（updateTask）でマージ後の値を使って同じ検証を再現する。
 * メッセージはここを唯一の真実の源にして両方から参照する。
 */
export const TASK_ORDER_MESSAGE = "終了日時は開始日時より後にしてください";

// ---- task（カレンダーイベント相当） ----
const taskInputBase = z.object({
  trackerPjId: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  assigneeId: z.string().uuid("担当者を選択してください"),
  title: name,
  startAt: isoDateTime,
  endAt: isoDateTime,
});
export const taskInputSchema = taskInputBase.refine(
  (v) => Date.parse(v.startAt) < Date.parse(v.endAt),
  { message: TASK_ORDER_MESSAGE, path: ["endAt"] }
);
export const taskPatchSchema = taskInputBase.partial();

// ---- 実績（拡張層） ----
export const taskEntryInputSchema = z.object({
  taskId: z.string().uuid(),
  year,
  month: z
    .number()
    .int()
    .min(1, "月は1〜12で指定してください")
    .max(12, "月は1〜12で指定してください"),
  hours,
});

// 入力型は z.input を使う。z.infer（= z.output）だと status の .default("open") が
// 適用済みの型になり、status を省略した呼び出しが型エラーになるため。
export type WorkerInput = z.input<typeof workerInputSchema>;
export type PjInput = z.input<typeof pjInputSchema>;
export type TrackerInput = z.input<typeof trackerInputSchema>;
export type IssueInput = z.input<typeof issueInputSchema>;
export type TaskInput = z.input<typeof taskInputSchema>;
export type TaskEntryInput = z.input<typeof taskEntryInputSchema>;

/** 検証の結果。失敗時は最初のメッセージを message に集約する。 */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; issues: string[] };

/**
 * スキーマで検証し、失敗時は人間可読なメッセージへ整形する薄いラッパ。
 * ストア側は例外ではなく値でハンドリングできる。
 */
export function validate<T>(
  schema: z.ZodType<T>,
  value: unknown
): ValidationResult<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issues = parsed.error.issues.map((i) => i.message);
  return {
    ok: false,
    message: issues[0] ?? "入力値が不正です",
    issues,
  };
}
