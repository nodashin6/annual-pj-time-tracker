"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { CARD, INPUT, BTN, BTN_GHOST, LABEL } from "@/lib/ui";

const PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function NewProjectForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { orders, teams, projects, addProject } = useStore();

  const [name, setName] = useState("");
  const [orderId, setOrderId] = useState(sp.get("order") ?? "");
  const [teamId, setTeamId] = useState("");
  const [color, setColor] = useState(PALETTE[projects.length % PALETTE.length]);
  const [initialHours, setInitialHours] = useState(0);
  const [plannedHours, setPlannedHours] = useState(0);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !orderId || saving) return;
    setSaving(true);
    const id = await addProject({
      name: name.trim(),
      orderId,
      teamId: teamId || undefined,
      color,
      initialHours,
      plannedHours,
    });
    if (id) router.push(`/projects/${id}`);
    else setSaving(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/projects"
          className="text-sm text-slate-500 hover:underline"
        >
          ← プロジェクト一覧
        </Link>
      </div>
      <h1 className="text-xl font-bold">新規プロジェクト</h1>

      {orders.length === 0 && (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          先に受注を作成してください。プロジェクトは受注に属します。{" "}
          <Link href="/orders/new" className="font-medium underline">
            受注を作成
          </Link>
        </p>
      )}

      <form onSubmit={submit} className={`${CARD} space-y-4`}>
        <div>
          <label className={LABEL}>プロジェクト名 *</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 cursor-pointer rounded border border-slate-200"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 基盤設計フェーズ"
              className={`flex-1 ${INPUT}`}
              autoFocus
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>受注 *</label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className={`w-full ${INPUT}`}
            >
              <option value="">受注を選択</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>担当チーム</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={`w-full ${INPUT}`}
            >
              <option value="">チームなし</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>当初工数 (h)</label>
            <input
              type="number"
              min={0}
              value={initialHours}
              onChange={(e) => setInitialHours(Number(e.target.value) || 0)}
              className={`w-full text-right ${INPUT}`}
            />
          </div>
          <div>
            <label className={LABEL}>予定工数 (h)</label>
            <input
              type="number"
              min={0}
              value={plannedHours}
              onChange={(e) => setPlannedHours(Number(e.target.value) || 0)}
              className={`w-full text-right ${INPUT}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          <button
            type="submit"
            className={BTN}
            disabled={!name.trim() || !orderId || saving}
          >
            {saving ? "作成中…" : "作成"}
          </button>
          <Link href="/projects" className={BTN_GHOST}>
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-400">読み込み中…</div>
      }
    >
      <NewProjectForm />
    </Suspense>
  );
}
