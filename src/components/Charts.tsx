"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Worker, Project } from "@/lib/types";

const CARD =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

export function MonthlyStackedBar({
  data,
  projects,
}: {
  data: Array<Record<string, number | string>>;
  projects: Project[];
}) {
  return (
    <div className={CARD}>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        月次 工数（プロジェクト別・積み上げ）
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit="h" />
          <Tooltip formatter={(v: number) => `${v} h`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {projects.map((p) => (
            <Bar
              key={p.id}
              dataKey={p.id}
              name={p.name}
              stackId="a"
              fill={p.color}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UtilizationLine({
  data,
  workers,
}: {
  data: Array<Record<string, number | string>>;
  workers: Worker[];
}) {
  const palette = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#8b5cf6"];
  return (
    <div className={CARD}>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        月次 稼働率（メンバー別 / 100%基準線）
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(v: number) => `${v} %`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 4" />
          {workers.map((w, i) => (
            <Line
              key={w.id}
              type="monotone"
              dataKey={w.id}
              name={w.name}
              stroke={palette[i % palette.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectPie({
  data,
}: {
  data: Array<{ project: Project; hours: number }>;
}) {
  const flat = data
    .filter((d) => d.hours > 0)
    .map((d) => ({
      id: d.project.id,
      name: d.project.name,
      hours: d.hours,
      color: d.project.color,
    }));
  return (
    <div className={CARD}>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        年間 プロジェクト構成比
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={flat}
            dataKey="hours"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={(e: { name?: string }) => e.name ?? ""}
          >
            {flat.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `${v} h`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
