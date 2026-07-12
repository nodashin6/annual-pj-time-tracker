/**
 * 環境変数の検証。
 * Supabase 接続情報を起動時に検証し、形式不正を早期に検知する。
 * 未設定はデモモード（UI で設定手順を表示）として許容し、
 * 「設定されているが形式が不正」なケースだけを明示的なエラーとして扱う。
 */
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .url("NEXT_PUBLIC_SUPABASE_URL は URL 形式である必要があります")
      .optional()
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY が短すぎます").optional()
  ),
});

export type Env = z.infer<typeof envSchema>;

export type EnvResult =
  | { ok: true; env: Env; configured: boolean }
  | { ok: false; issues: string[] };

/**
 * 環境変数を検証して返す。
 * - configured: URL と ANON_KEY が両方揃っているか（＝実接続モードか）
 */
export function readEnv(): EnvResult {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const env = parsed.data;
  const configured = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return { ok: true, env, configured };
}
