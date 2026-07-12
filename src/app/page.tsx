"use client";

import { useStore } from "@/lib/store";
import {
  monthlyStackByProject,
  annualByProject,
  orderProgress,
  workerHours,
  orgTotals,
} from "@/lib/aggregate";
import { StatCard } from "@/components/StatCard";
import { MonthlyStackedBar, ProjectPie } from "@/components/Charts";

/** 消化率の色: 予定超過は赤、健全域は緑、余裕は青。 */
function consumptionColor(pct: number): string {
  if (pct > 100) return "#ef4444";
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#0ea5e9";
}

export default function DashboardPage() {
  const { workers, clients, orders, projects, entries, year } = useStore();

  const totals = orgTotals(entries, orders, projects, year);
  const monthlyStack = monthlyStackByProject(entries, projects, year);
  const annual = annualByProject(entries, projects, year);
  const progress = orderProgress(entries, orders, projects, year);
  const whours = workerHours(entries, workers, year);

  const clientName = (id?: string) =>
    clients.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">ダッシュボード</h1>
        <p className="text-sm text-slate-500">{year}年 — 受注工数の充足状況</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="年間 実績工数"
          value={`${totals.totalHours.toLocaleString()} h`}
          sub={`約 ${Math.round(totals.totalHours / 8).toLocaleString()} 人日`}
        />
        <StatCard
          label="予定工数 合計"
          value={`${totals.totalPlanned.toLocaleString()} h`}
          sub={`受注 ${orders.length} 件`}
        />
        <StatCard
          label="消化率"
          value={`${totals.consumption} %`}
          accent={consumptionColor(totals.consumption)}
          sub="実績 / 予定"
        />
        <StatCard
          label="稼働PJ数"
          value={`${totals.activeProjects}`}
          sub={`登録 ${projects.length} 件`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyStackedBar data={monthlyStack} projects={projects} />
        <ProjectPie data={annual} />
      </div>

      {/* 受注別 工数の充足状況 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          受注別 工数（当初 / 予定 / 実績 / 消化率）
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">受注</th>
                <th className="py-2 pr-4 font-medium">顧客</th>
                <th className="py-2 pr-4 text-right font-medium">当初</th>
                <th className="py-2 pr-4 text-right font-medium">予定</th>
                <th className="py-2 pr-4 text-right font-medium">実績</th>
                <th className="py-2 pr-4 text-right font-medium">消化率</th>
                <th className="py-2 font-medium">進捗</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => (
                <tr key={p.order.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{p.order.name}</td>
                  <td className="py-2 pr-4 text-slate-500">
                    {clientName(p.order.clientId)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-500">
                    {p.initialHours.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {p.plannedHours.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums font-medium">
                    {p.actualHours.toLocaleString()}
                  </td>
                  <td
                    className="py-2 pr-4 text-right font-semibold tabular-nums"
                    style={{ color: consumptionColor(p.consumption) }}
                  >
                    {p.consumption} %
                  </td>
                  <td className="py-2">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(p.consumption, 100)}%`,
                          background: consumptionColor(p.consumption),
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {progress.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    受注が未登録です。「受注」から追加してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ワーカー別 投下工数（合計のみ） */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          ワーカー別 投下工数
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">ワーカー</th>
                <th className="py-2 pr-4 text-right font-medium">投下工数</th>
              </tr>
            </thead>
            <tbody>
              {whours.map((w) => (
                <tr key={w.worker.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{w.worker.name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {w.totalHours.toLocaleString()} h
                  </td>
                </tr>
              ))}
              {whours.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-400">
                    ワーカーが未登録です。
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
