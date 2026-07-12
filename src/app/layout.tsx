import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-6 py-6">
            <div className="mx-auto max-w-6xl">
              <DataGate>{children}</DataGate>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
