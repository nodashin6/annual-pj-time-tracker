"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { childrenOf, isLeaf, isContractNode } from "@/lib/aggregate/tree";
import type { Pj } from "@/lib/types";

function TreeRow({ pj, depth }: { pj: Pj; depth: number }) {
  const { pjs, trackers } = useStore();
  const children = childrenOf(pj.id, pjs);
  const leaf = isLeaf(pj.id, trackers);
  const [open, setOpen] = useState(true);

  return (
    <>
      <div
        className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm"
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        {children.length > 0 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "折りたたむ" : "展開する"}
            className="w-4 text-slate-400 hover:text-slate-600"
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: pj.color }}
        />
        <Link
          href={`/pj/${pj.id}`}
          className="font-medium text-slate-700 hover:text-indigo-600 hover:underline"
        >
          {pj.name}
        </Link>
        {isContractNode(pj) && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
            受注
          </span>
        )}
        {leaf && (
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
            葉
          </span>
        )}
      </div>
      {open &&
        children.map((c) => <TreeRow key={c.id} pj={c} depth={depth + 1} />)}
    </>
  );
}

export default function PjTreePage() {
  const { pjs, addPj } = useStore();
  const [name, setName] = useState("");
  const roots = childrenOf(undefined, pjs);

  const create = async () => {
    if (!name.trim()) return;
    await addPj({ name });
    setName("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">プロジェクト</h1>
        <span className="text-sm text-slate-500">{pjs.length} ノード</span>
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ルートノード名（顧客など）"
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={create}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          追加
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {roots.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            ノードがありません。上のフォームから追加してください。
          </div>
        ) : (
          roots.map((r) => <TreeRow key={r.id} pj={r} depth={0} />)
        )}
      </div>
    </div>
  );
}
