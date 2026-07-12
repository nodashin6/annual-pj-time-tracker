"use client";

import { useEffect } from "react";

/**
 * ルートセグメントのエラーバウンダリ。
 * レンダリング中の想定外例外を捕捉し、リセット導線を提示する。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
      <h2 className="mb-2 text-base font-bold">
        画面の表示中にエラーが発生しました
      </h2>
      <p className="mb-4 break-words text-red-700">
        {error.message || "予期しないエラーが発生しました。"}
      </p>
      {error.digest && (
        <p className="mb-4 text-xs text-red-500">
          エラー ID: <code>{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
      >
        再試行
      </button>
    </div>
  );
}
