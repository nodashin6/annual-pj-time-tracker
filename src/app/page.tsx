"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import {
  orgTotals,
  monthlyStackByLeaf,
  annualByLeaf,
  contractProgress,
  workerHours,
} from "@/lib/aggregate/progress";
import { leafPjs } from "@/lib/aggregate/tree";
import { tasksInYear } from "@/lib/aggregate/plan";
import { StatCard } from "@/components/StatCard";
import { MonthlyStackedBar, LeafPie } from "@/components/Charts";
import { consumptionColor } from "@/lib/ui";

export default function DashboardPage() {
  const { workers, pjs, trackers, tasks, taskEntries, year } = useStore();

  const leaves = leafPjs(pjs, trackers);
  const totals = orgTotals(taskEntries, tasks, pjs, trackers, year);
  const monthlyStack = monthlyStackByLeaf(taskEntries, tasks, leaves, year);
  const annual = annualByLeaf(taskEntries, tasks, leaves, year);
  const progress = contractProgress(taskEntries, tasks, pjs, year);
  const whours = workerHours(taskEntries, tasks, workers, year);

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
          sub={`task ${tasksInYear(tasks, year).length} 件から算出`}
        />
        <StatCard
          label="消化率"
          value={`${totals.consumption} %`}
          accent={consumptionColor(totals.consumption)}
          sub="実績 / 予定"
        />
        <StatCard
          label="稼働PJ数"
          value={`${totals.activeLeaves}`}
          sub={`葉pj ${leaves.length} 件`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyStackedBar data={monthlyStack} leaves={leaves} />
        <LeafPie data={annual} />
      </div>

      {/* 契約ノード別 工数の充足状況 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          契約ノード別 工数（予定 / 実績 / 消化率）
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">受注</th>
                <th className="py-2 pr-4 text-right font-medium">予定</th>
                <th className="py-2 pr-4 text-right font-medium">実績</th>
                <th className="py-2 pr-4 text-right font-medium">消化率</th>
                <th className="py-2 font-medium">進捗</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => (
                <tr key={p.pj.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">
                    <Link
                      href={`/pj/${p.pj.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {p.pj.name}
                    </Link>
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
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    契約ノードがありません。プロジェクトのノードに年度か予算を入力すると受注として集計されます。
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
