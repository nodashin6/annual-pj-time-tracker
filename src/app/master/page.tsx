"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CARD, INPUT, DEL, BTN } from "@/lib/ui";
import { notify } from "@/lib/notify";

export default function MasterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">マスタ管理</h1>
        <p className="text-sm text-slate-500">ワーカーを管理します</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:max-w-md">
        <WorkersSection />
      </div>

      <p className="text-xs text-slate-400">
        データは Supabase に保存されます。
      </p>
    </div>
  );
}

function WorkersSection() {
  const { workers, tasks, addWorker, updateWorker, removeWorker } = useStore();
  const [name, setName] = useState("");

  const removeWorkerSafely = (workerId: string, workerName: string) => {
    const taskCount = tasks.filter((t) => t.assigneeId === workerId).length;
    if (taskCount > 0) {
      notify.error(
        `「${workerName}」は task を${taskCount}件担当しているため削除できません。先に task の担当を変更するか削除してください。`
      );
      return;
    }
    if (!confirm(`「${workerName}」を削除します。よろしいですか？`)) return;
    removeWorker(workerId);
  };

  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">ワーカー</h2>
      <div className="space-y-2">
        {workers.map((w) => (
          <div key={w.id} className="flex items-center gap-2">
            <input
              value={w.name}
              onChange={(e) => updateWorker(w.id, { name: e.target.value })}
              className={`flex-1 ${INPUT}`}
            />
            <button
              onClick={() => removeWorkerSafely(w.id, w.name)}
              className={DEL}
            >
              削除
            </button>
          </div>
        ))}
        {workers.length === 0 && (
          <p className="text-sm text-slate-400">ワーカーがいません。</p>
        )}
      </div>
      <form
        className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addWorker({ name: name.trim() });
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="氏名を追加"
          className={`flex-1 ${INPUT}`}
        />
        <button className={BTN}>追加</button>
      </form>
    </section>
  );
}
