/**
 * ドメイン入力のバリデーションスキーマ（Zod）。
 *
 * フォーム/ストアの書き込み前にここで検証し、不正なデータが Supabase に
 * 到達するのを防ぐ。UI 表示型（types.ts）とは別に「入力（create/update）」の
 * 制約を集約する単一の真実の源。
 */
import { z } from "zod";

const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;

/** 名称: 前後空白を除去して 1〜120 文字。 */
const name = z
  .string()
  .trim()
  .min(1, "名称を入力してください")
  .max(120, "名称は120文字以内で入力してください");

/** 工数（時間）: 0 以上、上限は月次の現実的な上限を考慮し 100000。 */
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

/** 会計年度: 現実的な範囲。 */
const fiscalYear = z
  .number()
  .int("年度は整数で入力してください")
  .min(1970, "年度が範囲外です")
  .max(2999, "年度が範囲外です");

// ---- マスタ ----
export const teamInputSchema = z.object({ name });
export const workerInputSchema = z.object({ name });
export const clientInputSchema = z.object({ name });

// ---- 受注 ----
export const orderInputSchema = z.object({
  name,
  clientId: z.string().uuid().optional(),
  fiscalYear: fiscalYear.optional(),
  ownerWorkerId: z.string().uuid().optional(),
  initialHours: hours,
  plannedHours: hours,
  budgetAmount: amount.optional(),
});

// ---- プロジェクト ----
export const projectInputSchema = z.object({
  name,
  orderId: z.string().uuid("受注を選択してください"),
  teamId: z.string().uuid().optional(),
  color: z
    .string()
    .regex(HEX_COLOR, "カラーは #RRGGBB 形式で指定してください")
    .optional()
    .or(z.literal("")),
  initialHours: hours,
  plannedHours: hours,
});

// ---- 工数エントリ ----
export const entryInputSchema = z.object({
  workerId: z.string().uuid(),
  projectId: z.string().uuid(),
  year: fiscalYear,
  month: z.number().int().min(1).max(12),
  hours,
});

export type TeamInput = z.infer<typeof teamInputSchema>;
export type WorkerInput = z.infer<typeof workerInputSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type EntryInput = z.infer<typeof entryInputSchema>;

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
