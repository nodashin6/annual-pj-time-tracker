"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { filterByYear } from "@/lib/aggregate";
import { MONTHS, MONTH_LABELS } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { CARD, INPUT, LABEL, DEL, consumptionColor } from "@/lib/ui";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();

  const {
    projects,
    orders,
    teams,
    workers,
    assignments,
    milestones,
    entries,
    year,
    updateProject,
    removeProject,
    addAssignment,
    removeAssignment,
  } = useStore();

  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <div className="space-y-3">
        <Link href="/projects" className="text-sm text-slate-500 hover:underline">
          ← プロジェクト一覧
        </Link>
        <p className="text-slate-400">プロジェクトが見つかりません。</p>
      </div>
    );
  }

  const order = orders.find((o) => o.id === project.orderId);
  const projMilestones = milestones.filter((m) => m.projectId === id);
  const projAssignments = assignments.filter((a) => a.projectId === id);
  const yEntries = filterByYear(entries, year).filter((e) => e.projectId === id);
  const actualHours = yEntries.reduce((a, e) => a + e.hours, 0);
  const monthly = MONTHS.map((m) =>
    yEntries.filter((e) => e.month === m).reduce((a, e) => a + e.hours, 0)
  );
  const consumption =
    project.plannedHours > 0
      ? Math.round((actualHours / project.plannedHours) * 1000) / 10
      : 0;

  const toggleAssignment = (workerId: string) => {
    const a = projAssignments.find((x) => x.workerId === workerId);
    if (a) removeAssignment(a.id);
    else addAssignment(workerId, id);
  };

  const del = async () => {
    if (!confirm(`プロジェクト「${project.name}」を削除します。工数・アサインも削除されます。よろしいですか？`))
      return;
    await removeProject(id);
    router.push("/projects");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/projects" className="text-sm text-slate-500 hover:underline">
          ← プロジェクト一覧
        </Link>
        <button onClick={del} className={DEL}>
          プロジェクトを削除
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: project.color }}
        />
        <h1 className="text-xl font-bold">{project.name}</h1>
      </div>
      {order && (
        <p className="text-sm text-slate-500">
          受注:{" "}
          <Link href={`/orders/${order.id}`} className="text-indigo-600 hover:underline">
            {order.name}
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="当初工数" value={`${project.initialHours.toLocaleString()} h`} />
        <StatCard label="予定工数" value={`${project.plannedHours.toLocaleString()} h`} />
        <StatCard label="実績工数" value={`${actualHours.toLocaleString()} h`} sub={`${year}年`} />
        <StatCard
          label="消化率"
          value={`${consumption} %`}
          accent={consumptionColor(consumption)}
          sub="実績 / 予定"
        />
        <StatCard label="参加者" value={`${projAssignments.length} 名`} />
      </div>

      {/* 編集 */}
      <div className={`${CARD} space-y-4`}>
        <h2 className="font-semibold">プロジェクト情報</h2>
        <div>
          <label className={LABEL}>プロジェクト名</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={project.color}
              onChange={(e) => updateProject(id, { color: e.target.value })}
              className="h-9 w-9 cursor-pointer rounded border border-slate-200"
            />
            <input
              value={project.name}
              onChange={(e) => updateProject(id, { name: e.target.value })}
              className={`flex-1 ${INPUT}`}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>受注</label>
            <select
              value={project.orderId}
              onChange={(e) => updateProject(id, { orderId: e.target.value })}
              className={`w-full ${INPUT}`}
            >
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
              value={project.teamId ?? ""}
              onChange={(e) =>
                updateProject(id, { teamId: e.target.value || undefined })
              }
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
              value={project.initialHours}
              onChange={(e) =>
                updateProject(id, { initialHours: Number(e.target.value) || 0 })
              }
              className={`w-full text-right ${INPUT}`}
            />
          </div>
          <div>
            <label className={LABEL}>予定工数 (h)</label>
            <input
              type="number"
              min={0}
              value={project.plannedHours}
              onChange={(e) =>
                updateProject(id, { plannedHours: Number(e.target.value) || 0 })
              }
              className={`w-full text-right ${INPUT}`}
            />
          </div>
        </div>
      </div>

      {/* 参加者 */}
      <div className={CARD}>
        <h2 className="mb-3 font-semibold">参加者（アサイン）</h2>
        <div className="flex flex-wrap gap-1.5">
          {workers.map((w) => {
            const on = projAssignments.some((a) => a.workerId === w.id);
            return (
              <button
                key={w.id}
                onClick={() => toggleAssignment(w.id)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  on
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {w.name}
              </button>
            );
          })}
          {workers.length === 0 && (
            <span className="text-sm text-slate-400">ワーカー未登録</span>
          )}
        </div>
      </div>

      {/* 月次工数 */}
      <div className={CARD}>
        <h2 className="mb-3 font-semibold">月次 実績工数（{year}年）</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                {MONTH_LABELS.map((l) => (
                  <th key={l} className="px-2 py-2 text-center font-medium">
                    {l}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium">計</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {monthly.map((h, i) => (
                  <td key={i} className="px-2 py-2 text-center tabular-nums">
                    {h || "—"}
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-semibold tabular-nums">
                  {actualHours}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          工数の入力は{" "}
          <Link href="/worker-entries" className="underline">
            工数入力
          </Link>{" "}
          から行います。
        </p>
      </div>

      {/* マイルストーン */}
      <div className={CARD}>
        <h2 className="mb-3 font-semibold">マイルストーン（区間）</h2>
        <div className="space-y-1">
          {projMilestones.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm"
            >
              <span className="font-medium">{m.name ?? "（無題）"}</span>
              <span className="tabular-nums text-slate-500">
                {m.startDate} 〜 {m.endDate}
              </span>
            </div>
          ))}
          {projMilestones.length === 0 && (
            <p className="text-sm text-slate-400">マイルストーンがありません。</p>
          )}
        </div>
      </div>
    </div>
  );
}
