"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { YearSelector } from "./YearSelector";

const LINKS = [
  { href: "/", label: "ダッシュボード" },
  { href: "/clients", label: "顧客" },
  { href: "/orders", label: "受注" },
  { href: "/projects", label: "プロジェクト" },
  { href: "/worker-entries", label: "工数入力" },
  { href: "/master", label: "マスタ" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-indigo-600">◔</span>
          <span className="font-semibold">年間稼働トラッカー</span>
        </Link>
      </div>

      <div className="border-b border-slate-100 p-4">
        <YearSelector />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {LINKS.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
