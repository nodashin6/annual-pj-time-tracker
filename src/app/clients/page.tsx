"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { CARD, BTN } from "@/lib/ui";

export default function ClientsPage() {
  const { clients, orders } = useStore();

  const ordersOf = (clientId: string) =>
    orders.filter((o) => o.clientId === clientId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">顧客一覧</h1>
          <p className="text-sm text-slate-500">顧客ごとの受注をまとめて管理</p>
        </div>
        <Link href="/clients/new" className={BTN}>
          + 新規顧客
        </Link>
      </div>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">顧客名</th>
                <th className="py-2 pr-4 text-right font-medium">受注数</th>
                <th className="py-2 pr-4 text-right font-medium">
                  予定工数 計
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const os = ordersOf(c.id);
                const planned = os.reduce((a, o) => a + o.plannedHours, 0);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        href={`/clients/${c.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {os.length}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {planned.toLocaleString()} h
                    </td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400">
                    顧客がありません。「+ 新規顧客」から追加してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
