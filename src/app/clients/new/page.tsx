"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { CARD, INPUT, BTN, BTN_GHOST, LABEL } from "@/lib/ui";

export default function NewClientPage() {
  const router = useRouter();
  const { addClient } = useStore();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const id = await addClient({ name: name.trim() });
    if (id) router.push(`/clients/${id}`);
    else setSaving(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/clients" className="text-sm text-slate-500 hover:underline">
        ← 顧客一覧
      </Link>
      <h1 className="text-xl font-bold">新規顧客</h1>

      <form onSubmit={submit} className={`${CARD} space-y-4`}>
        <div>
          <label className={LABEL}>顧客名 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: A社"
            className={`w-full ${INPUT}`}
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={BTN} disabled={!name.trim() || saving}>
            {saving ? "作成中…" : "作成"}
          </button>
          <Link href="/clients" className={BTN_GHOST}>
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
