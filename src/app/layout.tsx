import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { DataGate } from "@/components/DataGate";

export const metadata: Metadata = {
  title: "年間稼働トラッカー",
  description:
    "プロジェクトの工数・稼働率・キャパを月次/年次で集計・可視化する稼働管理アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen">
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-6">
            <DataGate>{children}</DataGate>
          </main>
        </div>
      </body>
    </html>
  );
}
