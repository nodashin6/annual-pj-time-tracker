"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { CARD, INPUT, LABEL, DEL, BTN } from "@/lib/ui";

export default function ClientDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();

  const { clients, orders, updateClient, removeClient } = useStore();
  const client = clients.find((c) => c.id === id);

  if (!client) {
    return (
      <div className="space-y-3">
        <Link href="/clients" className="text-sm text-slate-500 hover:underline">
          ← 顧客一覧
        </Link>
        <p className="text-slate-400">顧客が見つかりません。</p>
      </div>
    );
  }

  const clientOrders = orders.filter((o) => o.clientId === id);

  const del = async () => {
    if (
      !confirm(
        `顧客「${client.name}」を削除します。配下受注の顧客はクリアされます（受注自体は残ります）。よろしいですか？`
      )
    )
      return;
    await removeClient(id);
    router.push("/clients");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/clients" className="text-sm text-slate-500 hover:underline">
          ← 顧客一覧
        </Link>
        <button onClick={del} className={DEL}>
          顧客を削除
        </button>
      </div>

      <h1 className="text-xl font-bold">{client.name}</h1>

      {/* 編集 */}
      <div className={`${CARD} space-y-4`}>
        <h2 className="font-semibold">顧客情報</h2>
        <div>
          <label className={LABEL}>顧客名</label>
          <input
            value={client.name}
            onChange={(e) => updateClient(id, { name: e.target.value })}
            className={`w-full ${INPUT}`}
          />
        </div>
      </div>

      {/* 配下受注 */}
      <div className={CARD}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">受注（{clientOrders.length}）</h2>
          <Link href={`/orders/new?client=${id}`} className={BTN}>
            + 受注追加
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">受注</th>
                <th className="py-2 pr-4 text-right font-medium">年度</th>
                <th className="py-2 pr-4 text-right font-medium">当初</th>
                <th className="py-2 pr-4 text-right font-medium">予定</th>
              </tr>
            </thead>
            <tbody>
              {clientOrders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-medium">
                    <Link
                      href={`/orders/${o.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {o.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-500">
                    {o.fiscalYear ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-500">
                    {o.initialHours.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {o.plannedHours.toLocaleString()}
                  </td>
                </tr>
              ))}
              {clientOrders.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    受注がありません。
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
