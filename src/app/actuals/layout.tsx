"use client";

export default function ActualsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">実績入力</h1>
        <p className="text-sm text-slate-500">
          ワーカーを選び、割り当てられた task の月次実績を入力します
        </p>
      </div>
      {children}
    </div>
  );
}
