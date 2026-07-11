"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

const CARD = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
const INPUT =
  "rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
const DEL = "rounded px-2 py-1 text-sm text-red-500 hover:bg-red-50";
const ADD =
  "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700";

export default function SetupPage() {
  const s = useStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">マスタ設定</h1>
        <p className="text-sm text-slate-500">
          顧客 → 受注 → プロジェクト の階層と、チーム・ワーカー・アサインを管理します
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WorkersSection />
        <TeamsSection />
        <ClientsSection />
        <OrdersSection />
      </div>

      <ProjectsSection />

      <p className="text-xs text-slate-400">データは Supabase に保存されます。</p>
    </div>
  );
}

function WorkersSection() {
  const { workers, addWorker, updateWorker, removeWorker } = useStore();
  const [name, setName] = useState("");
  const [cap, setCap] = useState(160);

  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">ワーカー</h2>
      <div className="space-y-2">
        {workers.map((w) => (
          <div key={w.id} className="flex items-center gap-2">
            <input
              value={w.name}
              onChange={(e) => updateWorker(w.id, { name: e.target.value })}
              className={`flex-1 ${INPUT}`}
            />
            <input
              type="number"
              min={0}
              value={w.monthlyCapacityHours}
              onChange={(e) =>
                updateWorker(w.id, {
                  monthlyCapacityHours: Number(e.target.value) || 0,
                })
              }
              className={`w-20 text-right ${INPUT}`}
            />
            <span className="text-xs text-slate-400">h/月</span>
            <button onClick={() => removeWorker(w.id)} className={DEL}>
              削除
            </button>
          </div>
        ))}
        {workers.length === 0 && (
          <p className="text-sm text-slate-400">ワーカーがいません。</p>
        )}
      </div>
      <form
        className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addWorker({ name: name.trim(), monthlyCapacityHours: cap });
          setName("");
          setCap(160);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="氏名を追加"
          className={`flex-1 ${INPUT}`}
        />
        <input
          type="number"
          min={0}
          value={cap}
          onChange={(e) => setCap(Number(e.target.value) || 0)}
          className={`w-20 text-right ${INPUT}`}
        />
        <button className={ADD}>追加</button>
      </form>
    </section>
  );
}

function TeamsSection() {
  const { teams, addTeam, updateTeam, removeTeam } = useStore();
  const [name, setName] = useState("");

  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">チーム</h2>
      <div className="space-y-2">
        {teams.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <input
              value={t.name}
              onChange={(e) => updateTeam(t.id, { name: e.target.value })}
              className={`flex-1 ${INPUT}`}
            />
            <button onClick={() => removeTeam(t.id)} className={DEL}>
              削除
            </button>
          </div>
        ))}
        {teams.length === 0 && (
          <p className="text-sm text-slate-400">チームがありません。</p>
        )}
      </div>
      <form
        className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addTeam({ name: name.trim() });
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="チーム名を追加"
          className={`flex-1 ${INPUT}`}
        />
        <button className={ADD}>追加</button>
      </form>
    </section>
  );
}

function ClientsSection() {
  const { clients, addClient, updateClient, removeClient } = useStore();
  const [name, setName] = useState("");

  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">顧客</h2>
      <div className="space-y-2">
        {clients.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <input
              value={c.name}
              onChange={(e) => updateClient(c.id, { name: e.target.value })}
              className={`flex-1 ${INPUT}`}
            />
            <button onClick={() => removeClient(c.id)} className={DEL}>
              削除
            </button>
          </div>
        ))}
        {clients.length === 0 && (
          <p className="text-sm text-slate-400">顧客がありません。</p>
        )}
      </div>
      <form
        className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addClient({ name: name.trim() });
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="顧客名を追加"
          className={`flex-1 ${INPUT}`}
        />
        <button className={ADD}>追加</button>
      </form>
    </section>
  );
}

function OrdersSection() {
  const {
    orders,
    clients,
    workers,
    addOrder,
    updateOrder,
    removeOrder,
  } = useStore();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [fiscalYear, setFiscalYear] = useState<number>(
    new Date().getFullYear()
  );

  const clientName = (id?: string) =>
    clients.find((c) => c.id === id)?.name ?? "—";

  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">受注</h2>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-2">
            <input
              value={o.name}
              onChange={(e) => updateOrder(o.id, { name: e.target.value })}
              className={`min-w-[8rem] flex-1 ${INPUT}`}
            />
            <select
              value={o.clientId ?? ""}
              onChange={(e) =>
                updateOrder(o.id, { clientId: e.target.value || undefined })
              }
              className={INPUT}
              title="顧客"
            >
              <option value="">顧客なし</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={o.fiscalYear ?? ""}
              placeholder="年度"
              onChange={(e) =>
                updateOrder(o.id, {
                  fiscalYear: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className={`w-20 text-right ${INPUT}`}
              title="会計年度"
            />
            <input
              type="number"
              min={0}
              value={o.plannedHours}
              onChange={(e) =>
                updateOrder(o.id, { plannedHours: Number(e.target.value) || 0 })
              }
              className={`w-24 text-right ${INPUT}`}
              title="想定工数(h)"
            />
            <select
              value={o.ownerWorkerId ?? ""}
              onChange={(e) =>
                updateOrder(o.id, {
                  ownerWorkerId: e.target.value || undefined,
                })
              }
              className={INPUT}
              title="担当"
            >
              <option value="">担当なし</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button onClick={() => removeOrder(o.id)} className={DEL}>
              削除
            </button>
          </div>
        ))}
        {orders.length === 0 && (
          <p className="text-sm text-slate-400">受注がありません。</p>
        )}
      </div>
      <form
        className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addOrder({
            name: name.trim(),
            clientId: clientId || undefined,
            fiscalYear,
            plannedHours: 0,
          });
          setName("");
          setClientId("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="受注名を追加"
          className={`min-w-[8rem] flex-1 ${INPUT}`}
        />
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className={INPUT}
        >
          <option value="">顧客を選択</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={fiscalYear}
          onChange={(e) => setFiscalYear(Number(e.target.value) || 0)}
          className={`w-20 text-right ${INPUT}`}
          title="会計年度"
        />
        <button className={ADD}>追加</button>
      </form>
      {orders.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          顧客: {orders.map((o) => clientName(o.clientId)).join(" / ")}
        </p>
      )}
    </section>
  );
}

function ProjectsSection() {
  const {
    projects,
    orders,
    teams,
    workers,
    assignments,
    addProject,
    updateProject,
    removeProject,
    addAssignment,
    removeAssignment,
  } = useStore();
  const [name, setName] = useState("");
  const [orderId, setOrderId] = useState("");
  const [teamId, setTeamId] = useState("");

  const orderName = (id: string) => orders.find((o) => o.id === id)?.name ?? "—";

  const toggleAssignment = (workerId: string, projectId: string) => {
    const a = assignments.find(
      (x) => x.workerId === workerId && x.projectId === projectId
    );
    if (a) removeAssignment(a.id);
    else addAssignment(workerId, projectId);
  };

  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">プロジェクト（受注を細分化）</h2>

      {orders.length === 0 && (
        <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          先に「受注」を追加してください。プロジェクトは受注に属します。
        </p>
      )}

      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-100 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={p.color}
                onChange={(e) => updateProject(p.id, { color: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded border border-slate-200"
              />
              <input
                value={p.name}
                onChange={(e) => updateProject(p.id, { name: e.target.value })}
                className={`min-w-[8rem] flex-1 ${INPUT}`}
              />
              <select
                value={p.orderId}
                onChange={(e) => updateProject(p.id, { orderId: e.target.value })}
                className={INPUT}
                title="受注"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <select
                value={p.teamId ?? ""}
                onChange={(e) =>
                  updateProject(p.id, { teamId: e.target.value || undefined })
                }
                className={INPUT}
                title="担当チーム"
              >
                <option value="">チームなし</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button onClick={() => removeProject(p.id)} className={DEL}>
                削除
              </button>
            </div>
            {/* アサイン: このプロジェクトに参加するワーカー */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-xs text-slate-400">参加者:</span>
              {workers.map((w) => {
                const on = assignments.some(
                  (a) => a.workerId === w.id && a.projectId === p.id
                );
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleAssignment(w.id, p.id)}
                    className={`rounded-full px-2 py-0.5 text-xs transition ${
                      on
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {w.name}
                  </button>
                );
              })}
              {workers.length === 0 && (
                <span className="text-xs text-slate-400">ワーカー未登録</span>
              )}
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-slate-400">プロジェクトがありません。</p>
        )}
      </div>

      <form
        className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !orderId) return;
          addProject({
            name: name.trim(),
            orderId,
            teamId: teamId || undefined,
            color: "",
          });
          setName("");
          setTeamId("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="プロジェクト名を追加"
          className={`min-w-[8rem] flex-1 ${INPUT}`}
        />
        <select
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className={INPUT}
        >
          <option value="">受注を選択</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className={INPUT}
        >
          <option value="">チームを選択</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className={ADD} disabled={orders.length === 0}>
          追加
        </button>
      </form>

      {projects.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          受注別:{" "}
          {Array.from(new Set(projects.map((p) => p.orderId)))
            .map((oid) => orderName(oid))
            .join(" / ")}
        </p>
      )}
    </section>
  );
}
