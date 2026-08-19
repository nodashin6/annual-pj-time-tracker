"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";

export default function ActualsIndexPage() {
  const { workers, tasks, taskEntries, year } = useStore();

  const workerTasks = (id: string) => tasks.filter((t) => t.assigneeId === id);
  const pjCount = (id: string) =>
    new Set(workerTasks(id).map((t) => t.trackerPjId)).size;
  const yearHours = (id: string) => {
    const taskIds = new Set(workerTasks(id).map((t) => t.id));
    return taskEntries
      .filter((e) => e.year === year && taskIds.has(e.taskId))
      .reduce((a, e) => a + e.hours, 0);
  };

  if (workers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
        ワーカーが未登録です。「マスタ」から登録してください。
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        入力するワーカーを選択してください。
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workers.map((w) => (
          <Link
            key={w.id}
            href={`/actuals/${w.id}`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
          >
            <div>
              <div className="font-semibold text-slate-800">{w.name}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {pjCount(w.id)} プロジェクト
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums text-slate-700">
                {yearHours(w.id).toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">h / {year}年</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
