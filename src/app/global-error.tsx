"use client";

import { useEffect } from "react";

/**
 * ルートレイアウト自体で例外が発生した場合の最終防衛ライン。
 * html/body を自前で描画する必要がある。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: 24,
            border: "1px solid #fecaca",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#7f1d1d",
          }}
        >
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>
            致命的なエラーが発生しました
          </h2>
          <p style={{ marginBottom: 16 }}>
            {error.message || "アプリケーションを読み込めませんでした。"}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#dc2626",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
