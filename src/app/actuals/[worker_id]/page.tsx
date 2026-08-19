"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import { useStore } from "@/lib/store";
import { plannedHoursOf, overlapsMonth } from "@/lib/aggregate/plan";
import { MONTHS, MONTH_LABELS } from "@/lib/types";
import type { Task } from "@/lib/types";

function ChildRow({
  task,
  year,
  hoursOf,
  rowTotal,
  onChange,
}: {
  task: Task;
  year: number;
  hoursOf: (taskId: string, month: number) => number;
  rowTotal: (taskId: string) => number;
  onChange: (taskId: string, month: number, hours: number) => void;
}) {
  return (
    <tr className="border-b border-slate-100 bg-slate-50/60">
      <td className="sticky left-0 bg-slate-50/60 py-2 pl-8 pr-3">
        <span className="text-slate-600">{task.title}</span>
        <span className="ml-2 text-xs text-slate-400">
          予定 {plannedHoursOf(task).toFixed(1)}h
        </span>
      </td>
      {MONTHS.map((m) => {
        const highlight = overlapsMonth(task, year, m);
        return (
          <td
            key={m}
            className={`px-1 py-1.5 text-center ${
              highlight ? "bg-indigo-50" : ""
            }`}
          >
            <input
              type="number"
              min={0}
              step={0.1}
              value={hoursOf(task.id, m) || ""}
              placeholder="0"
              onChange={(e) =>
                onChange(task.id, m, Number(e.target.value) || 0)
              }
              className="w-12 rounded border border-slate-200 px-1 py-1 text-right tabular-nums focus:border-indigo-500 focus:outline-none"
            />
          </td>
        );
      })}
      <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-600">
        {rowTotal(task.id)}
      </td>
    </tr>
  );
}

export default function ActualsWorkerPage() {
  const params = useParams();
  const workerId = String(params.worker_id);

  const { workers, pjs, tasks, taskEntries, year, setTaskHours } = useStore();
  const worker = workers.find((w) => w.id === workerId);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (pjId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pjId)) next.delete(pjId);
      else next.add(pjId);
      return next;
    });

  const workerTasks = tasks.filter((t) => t.assigneeId === workerId);

  const groups = new Map<string, Task[]>();
  for (const t of workerTasks) {
    const bucket = groups.get(t.trackerPjId);
    if (bucket) bucket.push(t);
    else groups.set(t.trackerPjId, [t]);
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  }

  const pjName = (pjId: string) =>
    pjs.find((p) => p.id === pjId)?.name ?? "(不明な pj)";
  const pjColor = (pjId: string) => pjs.find((p) => p.id === pjId)?.color;

  const leafPjIds = Array.from(groups.keys()).sort((a, b) =>
    pjName(a).localeCompare(pjName(b), "ja")
  );

  const hoursOf = (taskId: string, month: number): number =>
    taskEntries.find(
      (e) => e.taskId === taskId && e.year === year && e.month === month
    )?.hours ?? 0;

  const taskRowTotal = (taskId: string): number =>
    MONTHS.reduce((a, m) => a + hoursOf(taskId, m), 0);

  const pjMonthTotal = (pjTasks: Task[], month: number): number =>
    pjTasks.reduce((a, t) => a + hoursOf(t.id, month), 0);

  const pjRowTotal = (pjTasks: Task[]): number =>
    MONTHS.reduce((a, m) => a + pjMonthTotal(pjTasks, m), 0);

  const monthGrandTotal = (month: number): number =>
    workerTasks.reduce((a, t) => a + hoursOf(t.id, month), 0);

  const grandTotal = MONTHS.reduce((a, m) => a + monthGrandTotal(m), 0);

  const handleChange = (taskId: string, month: number, hours: number) => {
    setTaskHours({ taskId, year, month, hours });
  };

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
        href="/actuals"
        className="mb-3 inline-block text-sm text-slate-500 hover:underline"
      >
        ← ワーカー選択
      </Link>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">
          {worker.name}
          <span className="ml-2 text-sm font-normal text-slate-400">
            {year}年 / {leafPjIds.length} プロジェクト
          </span>
        </h2>
        <span className="text-sm text-slate-500">
          合計 <span className="font-semibold tabular-nums">{grandTotal}</span>{" "}
          h
        </span>
      </div>

      {workerTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          このワーカーに割り当てられた task がありません。
          <br />
          プロジェクトのカレンダーから作成してください。
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
              {leafPjIds.map((pjId) => {
                const pjTasks = groups.get(pjId) ?? [];
                const isOpen = expanded.has(pjId);
                return (
                  <Fragment key={pjId}>
                    <tr className="border-b border-slate-100">
                      <td className="sticky left-0 bg-white px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggle(pjId)}
                          className="flex items-center gap-2 text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="inline-block w-3 text-xs text-slate-400">
                            {isOpen ? "▾" : "▸"}
                          </span>
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: pjColor(pjId) ?? "#94a3b8" }}
                          />
                          <span className="font-medium text-slate-700">
                            {pjName(pjId)}
                          </span>
                        </button>
                      </td>
                      {MONTHS.map((m) => (
                        <td
                          key={m}
                          className="px-1.5 py-2 text-center tabular-nums text-slate-500"
                        >
                          {pjMonthTotal(pjTasks, m) || "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {pjRowTotal(pjTasks)}
                      </td>
                    </tr>
                    {isOpen &&
                      pjTasks.map((t) => (
                        <ChildRow
                          key={t.id}
                          task={t}
                          year={year}
                          hoursOf={hoursOf}
                          rowTotal={taskRowTotal}
                          onChange={handleChange}
                        />
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="sticky left-0 bg-slate-50 px-3 py-2">計</td>
                {MONTHS.map((m) => (
                  <td key={m} className="px-1.5 py-2 text-center tabular-nums">
                    {monthGrandTotal(m) || "—"}
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
