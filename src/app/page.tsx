"use client";

import { useStore } from "@/lib/store";
import {
  monthlyStackByProject,
  annualByProject,
  monthlyUtilization,
  workerSummaries,
  orgTotals,
} from "@/lib/aggregate";
import { StatCard } from "@/components/StatCard";
import { YearSelector } from "@/components/YearSelector";
import {
  MonthlyStackedBar,
  UtilizationLine,
  ProjectPie,
} from "@/components/Charts";

function utilColor(util: number): string {
  if (util >= 100) return "#ef4444";
  if (util >= 85) return "#10b981";
  if (util >= 60) return "#f59e0b";
  return "#0ea5e9";
}

export default function DashboardPage() {
  const { workers, projects, entries, year } = useStore();

  const totals = orgTotals(entries, workers, projects, year);
  const monthlyStack = monthlyStackByProject(entries, projects, year);
  const annual = annualByProject(entries, projects, year);
  const util = monthlyUtilization(entries, workers, year);
  const summaries = workerSummaries(entries, workers, year);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ダッシュボード</h1>
          <p className="text-sm text-slate-500">
            {year}年の稼働サマリ
          </p>
        </div>
        <YearSelector />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="年間 総工数"
          value={`${totals.totalHours.toLocaleString()} h`}
          sub={`約 ${Math.round(totals.totalHours / 8).toLocaleString()} 人日`}
        />
        <StatCard
          label="年間 キャパ"
          value={`${totals.totalCapacity.toLocaleString()} h`}
          sub={`メンバー ${workers.length} 名`}
        />
        <StatCard
          label="全体 稼働率"
          value={`${totals.utilization} %`}
          accent={utilColor(totals.utilization)}
          sub="総工数 / 総キャパ"
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

      <UtilizationLine data={util} workers={workers} />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          メンバー別 年間稼働率
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">メンバー</th>
                <th className="py-2 pr-4 text-right font-medium">投下工数</th>
                <th className="py-2 pr-4 text-right font-medium">年間キャパ</th>
                <th className="py-2 pr-4 text-right font-medium">稼働率</th>
                <th className="py-2 font-medium">状況</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.worker.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{s.worker.name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {s.totalHours.toLocaleString()} h
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-500">
                    {s.capacityHours.toLocaleString()} h
                  </td>
                  <td
                    className="py-2 pr-4 text-right font-semibold tabular-nums"
                    style={{ color: utilColor(s.utilization) }}
                  >
                    {s.utilization} %
                  </td>
                  <td className="py-2">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(s.utilization, 100)}%`,
                          background: utilColor(s.utilization),
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {summaries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    メンバーが未登録です。「メンバー・PJ設定」から追加してください。
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
