"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "ダッシュボード" },
  { href: "/clients", label: "顧客" },
  { href: "/orders", label: "受注" },
  { href: "/projects", label: "プロジェクト" },
  { href: "/worker-entries", label: "工数入力" },
  { href: "/master", label: "マスタ" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-indigo-600">◔</span>
          <span className="font-semibold">年間稼働トラッカー</span>
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
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
      </div>
    </header>
  );
}
