"use client";

import { useStore } from "@/lib/store";
import { availableYears } from "@/lib/aggregate";

export function YearSelector() {
  const year = useStore((s) => s.year);
  const setYear = useStore((s) => s.setYear);
  const entries = useStore((s) => s.entries);

  const years = availableYears(entries, year);
  // 隣接年も選べるよう前後1年を足す
  const options = Array.from(new Set([...years, year - 1, year + 1])).sort(
    (a, b) => b - a
  );

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-400">対象年</label>
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm focus:border-indigo-500 focus:outline-none"
      >
        {options.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
    </div>
  );
}
