"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { MONTHS, MONTH_LABELS } from "@/lib/types";

export default function WorkerEntriesPage() {
  const params = useParams();
  const workerId = String(params.worker_id);

  const { workers, projects, assignments, entries, year, setHours } =
    useStore();
  const worker = workers.find((w) => w.id === workerId);

  const assignedProjectIds = new Set(
    assignments.filter((a) => a.workerId === workerId).map((a) => a.projectId)
  );
  const assignedProjects = projects.filter((p) => assignedProjectIds.has(p.id));

  const get = (projectId: string, month: number): number => {
    const e = entries.find(
      (x) =>
        x.workerId === workerId &&
        x.projectId === projectId &&
        x.year === year &&
        x.month === month
    );
    return e?.hours ?? 0;
  };

  const rowTotal = (projectId: string) =>
    MONTHS.reduce((a, m) => a + get(projectId, m), 0);
  const monthTotal = (month: number) =>
    assignedProjects.reduce((a, p) => a + get(p.id, month), 0);
  const grandTotal = assignedProjects.reduce((a, p) => a + rowTotal(p.id), 0);

  if (!worker) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
        ワーカーが見つかりません。
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/worker-entries"
        className="mb-3 inline-block text-sm text-slate-500 hover:underline"
      >
        ← ワーカー選択
      </Link>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">
          {worker.name}
          <span className="ml-2 text-sm font-normal text-slate-400">
            {year}年 / {assignedProjects.length} プロジェクト
          </span>
        </h2>
        <span className="text-sm text-slate-500">
          合計 <span className="font-semibold tabular-nums">{grandTotal}</span>{" "}
          h
        </span>
      </div>

      {assignedProjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          このワーカーに割り当てられたプロジェクトがありません。
          <br />
          プロジェクト詳細の「参加者」からアサインしてください。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">
                  プロジェクト
                </th>
                {MONTH_LABELS.map((l) => (
                  <th key={l} className="px-1.5 py-2 text-center font-medium">
                    {l}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">計</th>
              </tr>
            </thead>
            <tbody>
              {assignedProjects.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="sticky left-0 bg-white px-3 py-2">
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ background: p.color }}
                    />
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-slate-700 hover:text-indigo-600 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="px-1 py-1.5 text-center">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={get(p.id, m) || ""}
                        placeholder="0"
                        onChange={(e) =>
                          setHours({
                            workerId,
                            projectId: p.id,
                            year,
                            month: m,
                            hours: Number(e.target.value) || 0,
                          })
                        }
                        className="w-12 rounded border border-slate-200 px-1 py-1 text-right tabular-nums focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {rowTotal(p.id)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="sticky left-0 bg-slate-50 px-3 py-2">計</td>
                {MONTHS.map((m) => (
                  <td key={m} className="px-1.5 py-2 text-center tabular-nums">
                    {monthTotal(m) || "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
