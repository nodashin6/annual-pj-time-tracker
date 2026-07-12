"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { orderProgress } from "@/lib/aggregate";
import { CARD, BTN, consumptionColor } from "@/lib/ui";

export default function OrdersPage() {
  const { orders, projects, clients, entries, year } = useStore();
  const progress = orderProgress(entries, orders, projects, year);

  const clientName = (id?: string) =>
    clients.find((c) => c.id === id)?.name ?? "—";
  const projCount = (orderId: string) =>
    projects.filter((p) => p.orderId === orderId).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">受注一覧</h1>
          <p className="text-sm text-slate-500">
            {year}年 — 受注ごとの工数充足
          </p>
        </div>
        <Link href="/orders/new" className={BTN}>
          + 新規受注
        </Link>
      </div>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">受注</th>
                <th className="py-2 pr-4 font-medium">顧客</th>
                <th className="py-2 pr-4 text-right font-medium">年度</th>
                <th className="py-2 pr-4 text-right font-medium">PJ数</th>
                <th className="py-2 pr-4 text-right font-medium">当初</th>
                <th className="py-2 pr-4 text-right font-medium">予定</th>
                <th className="py-2 pr-4 text-right font-medium">実績</th>
                <th className="py-2 pr-4 text-right font-medium">消化率</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => (
                <tr
                  key={p.order.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-2 pr-4 font-medium">
                    <Link
                      href={`/orders/${p.order.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {p.order.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-slate-500">
                    {clientName(p.order.clientId)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-500">
                    {p.order.fiscalYear ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {projCount(p.order.id)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-500">
                    {p.initialHours.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {p.plannedHours.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium tabular-nums">
                    {p.actualHours.toLocaleString()}
                  </td>
                  <td
                    className="py-2 pr-4 text-right font-semibold tabular-nums"
                    style={{ color: consumptionColor(p.consumption) }}
                  >
                    {p.consumption} %
                  </td>
                </tr>
              ))}
              {progress.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    受注がありません。「+ 新規受注」から追加してください。
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
