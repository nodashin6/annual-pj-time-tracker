"use client";

import type { z } from "zod";
import { notify } from "../notify";
import { validate } from "../schemas";
import type { Status } from "./types";

/** DB 例外を状態とトーストの両方へ反映する。 */
export function fail(
  set: (p: { status: Status; error: string }) => void,
  e: unknown
): void {
  const msg = e instanceof Error ? e.message : String(e);
  set({ status: "error", error: msg });
  notify.error(`データ操作に失敗しました: ${msg}`);
  console.error("[store]", msg);
}

/**
 * 入力をスキーマで検証する。失敗時はトーストで通知して null を返す。
 * 各 add/update アクションの先頭で使う。
 */
export function check<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = validate(schema, value);
  if (!result.ok) {
    notify.error(result.message);
    return null;
  }
  return result.data;
}

/**
 * undefined のキーを落として snake_case のパッチを組む。
 *
 * 呼び出し側との規約（nullable 列の update アクション全般で守ること）:
 * - `patch` にキーが無い　　　　　　→ 変更しない（このオブジェクトにもキーを渡さず undefined にする）
 * - `patch` にキーがあり値が undefined → 明示的にクリア（このオブジェクトには `null` を渡す）
 * - `patch` にキーがあり値がある　　　→ その値に更新
 *
 * キーの有無の判定は `"foo" in patch` で行う。`patch.foo === undefined` で
 * 判定すると「クリア」と「変更しない」を区別できなくなるので使わないこと。
 */
export function patchOf(
  map: Record<string, unknown | undefined>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
