"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { CARD, INPUT, BTN, BTN_GHOST, LABEL } from "@/lib/ui";

function NewOrderForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { clients, workers, addOrder } = useStore();

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(sp.get("client") ?? "");
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [ownerWorkerId, setOwnerWorkerId] = useState("");
  const [initialHours, setInitialHours] = useState(0);
  const [plannedHours, setPlannedHours] = useState(0);
  const [budget, setBudget] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const id = await addOrder({
      name: name.trim(),
      clientId: clientId || undefined,
      fiscalYear,
      ownerWorkerId: ownerWorkerId || undefined,
      initialHours,
      plannedHours,
      budgetAmount: budget === "" ? undefined : Number(budget),
    });
    if (id) router.push(`/orders/${id}`);
    else setSaving(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/orders" className="text-sm text-slate-500 hover:underline">
          ← 受注一覧
        </Link>
      </div>
      <h1 className="text-xl font-bold">新規受注</h1>

      <form onSubmit={submit} className={`${CARD} space-y-4`}>
        <div>
          <label className={LABEL}>受注名 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 社内基盤刷新 受注"
            className={`w-full ${INPUT}`}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>顧客</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
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
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value) || 0)}
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>担当</label>
            <select
              value={ownerWorkerId}
              onChange={(e) => setOwnerWorkerId(e.target.value)}
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
              value={budget}
              onChange={(e) =>
                setBudget(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="任意"
              className={`w-full text-right ${INPUT}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={BTN} disabled={!name.trim() || saving}>
            {saving ? "作成中…" : "作成"}
          </button>
          <Link href="/orders" className={BTN_GHOST}>
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">読み込み中…</div>}>
      <NewOrderForm />
    </Suspense>
  );
}
