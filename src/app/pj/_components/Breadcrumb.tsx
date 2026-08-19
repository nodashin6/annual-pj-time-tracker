"use client";

import Link from "next/link";
import type { Pj } from "@/lib/types";

/**
 * pj ツリーのパンくず。`breadcrumb(id, pjs)` の結果を渡す。
 * 自分自身はリンクにせず現在地として表示する。
 */
export function Breadcrumb({ crumbs, id }: { crumbs: Pj[]; id: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      {crumbs.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-300">/</span>}
          {c.id === id ? (
            <span className="font-medium text-slate-700">{c.name}</span>
          ) : (
            <Link href={`/pj/${c.id}`} className="hover:underline">
              {c.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
