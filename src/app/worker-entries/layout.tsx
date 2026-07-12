"use client";

export default function WorkerEntriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">工数入力</h1>
        <p className="text-sm text-slate-500">
          ワーカーを選び、割り当てられたプロジェクトの月次工数を入力します
        </p>
      </div>
      {children}
    </div>
  );
}
