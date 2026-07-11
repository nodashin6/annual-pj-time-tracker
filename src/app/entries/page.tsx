"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { YearSelector } from "@/components/YearSelector";
import { MONTHS, MONTH_LABELS } from "@/lib/types";

export default function EntriesPage() {
  const { workers, projects, entries, year, setHours } = useStore();
  const [month, setMonth] = useState(1);

  const get = (workerId: string, projectId: string): number => {
    const e = entries.find(
      (x) =>
        x.workerId === workerId &&
        x.projectId === projectId &&
        x.year === year &&
        x.month === month
    );
    return e?.hours ?? 0;
  };

  const workerTotal = (workerId: string) =>
    projects.reduce((a, p) => a + get(workerId, p.id), 0);
  const projectTotal = (projectId: string) =>
    workers.reduce((a, w) => a + get(w.id, projectId), 0);
  const grandTotal = workers.reduce((a, w) => a + workerTotal(w.id), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">工数入力</h1>
          <p className="text-sm text-slate-500">
            メンバー×プロジェクトの月次工数（時間）を入力します
          </p>
        </div>
        <YearSelector />
      </div>

      <div className="flex flex-wrap gap-1">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              month === m
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {MONTH_LABELS[i]}
          </button>
        ))}
      </div>

      {workers.length === 0 || projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
          メンバーとプロジェクトを「メンバー・PJ設定」から登録してください。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="sticky left-0 bg-slate-50 px-3 py-2 font-medium">
                  メンバー \ PJ
                </th>
                {projects.map((p) => (
                  <th key={p.id} className="px-2 py-2 text-center font-medium">
                    <span
                      className="inline-block h-2 w-2 rounded-full align-middle"
                      style={{ background: p.color }}
                    />{" "}
                    {p.name}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">計</th>
                <th className="px-3 py-2 text-right font-medium">稼働率</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const total = workerTotal(w.id);
                const util =
                  w.monthlyCapacityHours > 0
                    ? Math.round((total / w.monthlyCapacityHours) * 1000) / 10
                    : 0;
                return (
                  <tr key={w.id} className="border-b border-slate-100">
                    <td className="sticky left-0 bg-white px-3 py-2 font-medium">
                      {w.name}
                      <span className="ml-1 text-xs text-slate-400">
                        /{w.monthlyCapacityHours}h
                      </span>
                    </td>
                    {projects.map((p) => (
                      <td key={p.id} className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={get(w.id, p.id) || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setHours({
                              workerId: w.id,
                              projectId: p.id,
                              year,
                              month,
                              hours: Number(e.target.value) || 0,
                            })
                          }
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-right tabular-nums focus:border-indigo-500 focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {total} h
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular-nums"
                      style={{ color: util >= 100 ? "#ef4444" : "#475569" }}
                    >
                      {util} %
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="sticky left-0 bg-slate-50 px-3 py-2">計</td>
                {projects.map((p) => (
                  <td key={p.id} className="px-2 py-2 text-center tabular-nums">
                    {projectTotal(p.id)} h
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">
                  {grandTotal} h
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
