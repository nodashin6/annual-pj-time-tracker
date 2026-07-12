"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { envIssues } from "@/lib/supabase";

/**
 * Supabase からの初期ロードを担うゲート。
 * - 環境変数不正: 形式エラーバナー
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

  if (envIssues.length > 0) {
    return <EnvErrorNotice issues={envIssues} />;
  }

  if (status === "idle" || status === "loading") {
    return <LoadingSkeleton />;
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

function LoadingSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-7 w-48 rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-xl bg-slate-200" />
        <div className="h-64 rounded-xl bg-slate-200" />
      </div>
      <span className="sr-only">読み込み中…</span>
    </div>
  );
}

function EnvErrorNotice({ issues }: { issues: string[] }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
      <h2 className="mb-2 text-base font-bold">
        環境変数の設定に問題があります
      </h2>
      <p className="mb-3">
        Supabase の接続情報が不正な形式です。
        <code className="rounded bg-white px-1">.env.local</code>{" "}
        を確認してください。
      </p>
      <ul className="list-disc space-y-1 pl-5">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
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
