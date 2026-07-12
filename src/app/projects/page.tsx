"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { annualByProject } from "@/lib/aggregate";
import { CARD, BTN } from "@/lib/ui";

export default function ProjectsPage() {
  const { projects, orders, clients, teams, assignments, entries, year } =
    useStore();
  const annual = annualByProject(entries, projects, year);

  const orderOf = (id: string) => orders.find((o) => o.id === id);
  const clientName = (id?: string) =>
    clients.find((c) => c.id === id)?.name ?? "—";
  const teamName = (id?: string) => teams.find((t) => t.id === id)?.name ?? "—";
  const assigneeCount = (projectId: string) =>
    assignments.filter((a) => a.projectId === projectId).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">プロジェクト一覧</h1>
          <p className="text-sm text-slate-500">{year}年 — 受注を細分化した作業単位</p>
        </div>
        <Link href="/projects/new" className={BTN}>
          + 新規プロジェクト
        </Link>
      </div>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">顧客名</th>
                <th className="py-2 pr-4 font-medium">受注</th>
                <th className="py-2 pr-4 font-medium">プロジェクト名</th>
                <th className="py-2 pr-4 font-medium">チーム</th>
                <th className="py-2 pr-4 text-right font-medium">参加者</th>
                <th className="py-2 pr-4 text-right font-medium">当初工数</th>
                <th className="py-2 pr-4 text-right font-medium">予定工数</th>
                <th className="py-2 pr-4 text-right font-medium">実績工数</th>
              </tr>
            </thead>
            <tbody>
              {annual.map(({ project: p, hours }) => {
                const order = orderOf(p.orderId);
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4 text-slate-500">
                      {clientName(order?.clientId)}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">
                      <Link
                        href={`/orders/${p.orderId}`}
                        className="hover:underline"
                      >
                        {order?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ background: p.color }}
                      />
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{teamName(p.teamId)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {assigneeCount(p.id)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-slate-500">
                      {p.initialHours.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {p.plannedHours.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium tabular-nums">
                      {hours.toLocaleString()} h
                    </td>
                  </tr>
                );
              })}
              {annual.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    プロジェクトがありません。「+ 新規プロジェクト」から追加してください。
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
