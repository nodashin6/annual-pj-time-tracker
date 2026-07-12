"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { filterByYear } from "@/lib/aggregate";
import { StatCard } from "@/components/StatCard";
import { YearSelector } from "@/components/YearSelector";
import {
  CARD,
  INPUT,
  LABEL,
  DEL,
  BTN,
  consumptionColor,
} from "@/lib/ui";

export default function OrderDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();

  const {
    orders,
    clients,
    workers,
    projects,
    entries,
    year,
    updateOrder,
    removeOrder,
  } = useStore();

  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="space-y-3">
        <Link href="/orders" className="text-sm text-slate-500 hover:underline">
          ← 受注一覧
        </Link>
        <p className="text-slate-400">受注が見つかりません。</p>
      </div>
    );
  }

  const orderProjects = projects.filter((p) => p.orderId === id);
  const pids = new Set(orderProjects.map((p) => p.id));
  const yEntries = filterByYear(entries, year);
  const actualHours = yEntries
    .filter((e) => pids.has(e.projectId))
    .reduce((a, e) => a + e.hours, 0);
  const consumption =
    order.plannedHours > 0
      ? Math.round((actualHours / order.plannedHours) * 1000) / 10
      : 0;

  const projActual = (projectId: string) =>
    yEntries
      .filter((e) => e.projectId === projectId)
      .reduce((a, e) => a + e.hours, 0);

  const del = async () => {
    if (!confirm(`受注「${order.name}」を削除します。配下のプロジェクト・工数も削除されます。よろしいですか？`))
      return;
    await removeOrder(id);
    router.push("/orders");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/orders" className="text-sm text-slate-500 hover:underline">
          ← 受注一覧
        </Link>
        <div className="flex items-center gap-3">
          <YearSelector />
          <button onClick={del} className={DEL}>
            受注を削除
          </button>
        </div>
      </div>

      <h1 className="text-xl font-bold">{order.name}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="当初工数" value={`${order.initialHours.toLocaleString()} h`} />
        <StatCard label="予定工数" value={`${order.plannedHours.toLocaleString()} h`} />
        <StatCard label="実績工数" value={`${actualHours.toLocaleString()} h`} sub={`${year}年`} />
        <StatCard
          label="消化率"
          value={`${consumption} %`}
          accent={consumptionColor(consumption)}
          sub="実績 / 予定"
        />
      </div>

      {/* 編集 */}
      <div className={`${CARD} space-y-4`}>
        <h2 className="font-semibold">受注情報</h2>
        <div>
          <label className={LABEL}>受注名</label>
          <input
            value={order.name}
            onChange={(e) => updateOrder(id, { name: e.target.value })}
            className={`w-full ${INPUT}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>顧客</label>
            <select
              value={order.clientId ?? ""}
              onChange={(e) =>
                updateOrder(id, { clientId: e.target.value || undefined })
              }
              className={`w-full ${INPUT}`}
            >
              <option value="">顧客なし</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>会計年度</label>
            <input
              type="number"
              value={order.fiscalYear ?? ""}
              onChange={(e) =>
                updateOrder(id, {
                  fiscalYear: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className={`w-full text-right ${INPUT}`}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>当初工数 (h)</label>
            <input
              type="number"
              min={0}
              value={order.initialHours}
              onChange={(e) =>
                updateOrder(id, { initialHours: Number(e.target.value) || 0 })
              }
              className={`w-full text-right ${INPUT}`}
            />
          </div>
          <div>
            <label className={LABEL}>予定工数 (h)</label>
            <input
              type="number"
              min={0}
              value={order.plannedHours}
              onChange={(e) =>
                updateOrder(id, { plannedHours: Number(e.target.value) || 0 })
              }
              className={`w-full text-right ${INPUT}`}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>担当</label>
            <select
              value={order.ownerWorkerId ?? ""}
              onChange={(e) =>
                updateOrder(id, { ownerWorkerId: e.target.value || undefined })
              }
              className={`w-full ${INPUT}`}
            >
              <option value="">担当なし</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>予算 (円)</label>
            <input
              type="number"
              min={0}
              value={order.budgetAmount ?? ""}
              onChange={(e) =>
                updateOrder(id, {
                  budgetAmount: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className={`w-full text-right ${INPUT}`}
            />
          </div>
        </div>
      </div>

      {/* 配下プロジェクト */}
      <div className={CARD}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">プロジェクト（{orderProjects.length}）</h2>
          <Link href={`/projects/new?order=${id}`} className={BTN}>
            + プロジェクト追加
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">プロジェクト</th>
                <th className="py-2 pr-4 text-right font-medium">実績工数</th>
              </tr>
            </thead>
            <tbody>
              {orderProjects.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-medium">
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ background: p.color }}
                    />
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {projActual(p.id).toLocaleString()} h
                  </td>
                </tr>
              ))}
              {orderProjects.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-400">
                    プロジェクトがありません。
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
