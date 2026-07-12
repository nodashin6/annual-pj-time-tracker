"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Supabase からの初期ロードを担うゲート。
 * - 未設定: 設定手順バナー
 * - 読み込み中: プレースホルダ
 * - エラー: エラーバナー
 * - 準備完了: children を描画
 */
export function DataGate({ children }: { children: React.ReactNode }) {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const load = useStore((s) => s.load);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  if (status === "idle" || status === "loading") {
    return <div className="py-20 text-center text-slate-400">読み込み中…</div>;
  }

  if (status === "unconfigured") {
    return <UnconfiguredNotice />;
  }

  return (
    <>
      {status === "error" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          データ操作でエラーが発生しました: {error}
        </div>
      )}
      {children}
    </>
  );
}

function UnconfiguredNotice() {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <h2 className="mb-2 text-base font-bold">Supabase の設定が必要です</h2>
      <p className="mb-3">
        バックエンドは Supabase を使用します。以下の手順で接続してください。
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Supabase プロジェクトの <b>SQL Editor</b> で{" "}
          <code className="rounded bg-white px-1">supabase/schema.sql</code>{" "}
          を実行（テーブル作成＋サンプル投入）。
        </li>
        <li>
          プロジェクトルートに{" "}
          <code className="rounded bg-white px-1">.env.local</code>{" "}
          を作成し、次を設定：
          <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`}</pre>
          （値は Supabase &gt; Project Settings &gt; API から取得）
        </li>
        <li>
          開発サーバーを再起動：
          <code className="ml-1 rounded bg-white px-1">npm run dev</code>
        </li>
      </ol>
    </div>
  );
}
