"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  breadcrumb,
  childrenOf,
  isLeaf,
  isContractNode,
  effectiveMembers,
} from "@/lib/aggregate/tree";
import type { Pj, PjMember, Tracker, Worker } from "@/lib/types";
import { CARD, INPUT, LABEL, DEL, BTN } from "@/lib/ui";

function Breadcrumb({ crumbs, id }: { crumbs: Pj[]; id: string }) {
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

function BasicInfoCard({
  pj,
  workers,
  onChange,
}: {
  pj: Pj;
  workers: Worker[];
  onChange: (patch: {
    name?: string;
    color?: string;
    ownerWorkerId?: string;
    fiscalYear?: number;
    budgetAmount?: number;
  }) => void;
}) {
  return (
    <div className={`${CARD} space-y-4`}>
      <h2 className="font-semibold">基本情報</h2>
      <div>
        <label className={LABEL}>名称</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={pj.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-9 w-9 cursor-pointer rounded border border-slate-200"
          />
          <input
            value={pj.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={`flex-1 ${INPUT}`}
          />
        </div>
      </div>
      <div>
        <label className={LABEL}>担当者</label>
        <select
          value={pj.ownerWorkerId ?? ""}
          onChange={(e) =>
            onChange({ ownerWorkerId: e.target.value || undefined })
          }
          className={`w-full ${INPUT}`}
        >
          <option value="">未設定</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>年度</label>
          <input
            type="number"
            value={pj.fiscalYear ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ fiscalYear: v === "" ? undefined : Number(v) });
            }}
            className={`w-full text-right ${INPUT}`}
          />
        </div>
        <div>
          <label className={LABEL}>予算 (円)</label>
          <input
            type="number"
            min={0}
            value={pj.budgetAmount ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ budgetAmount: v === "" ? undefined : Number(v) });
            }}
            className={`w-full text-right ${INPUT}`}
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        年度・予算のいずれかを入力すると受注（契約単位）として扱われます。
      </p>
    </div>
  );
}

function MembersCard({
  members,
  effective,
  candidateWorkers,
  workerName,
  addMemberId,
  setAddMemberId,
  onAdd,
  onRemove,
}: {
  members: PjMember[];
  effective: string[];
  candidateWorkers: Worker[];
  workerName: (wid?: string) => string;
  addMemberId: string;
  setAddMemberId: (v: string) => void;
  onAdd: () => void;
  onRemove: (workerId: string) => void;
}) {
  return (
    <div className={CARD}>
      <h2 className="mb-3 font-semibold">メンバー</h2>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {members.map((m) => (
          <span
            key={m.workerId}
            className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
          >
            {workerName(m.workerId)}
            <button
              onClick={() => onRemove(m.workerId)}
              aria-label="メンバーを削除"
              className="text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
        {members.length === 0 && (
          <span className="text-sm text-slate-400">
            メンバーが登録されていません。
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <select
          value={addMemberId}
          onChange={(e) => setAddMemberId(e.target.value)}
          className={`flex-1 ${INPUT}`}
        >
          <option value="">ワーカーを選択…</option>
          {candidateWorkers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <button onClick={onAdd} className={BTN}>
          追加
        </button>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className={LABEL}>有効メンバー（祖先からの継承を含む）</p>
        <div className="flex flex-wrap gap-1.5">
          {effective.map((wid) => (
            <span
              key={wid}
              className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700"
            >
              {workerName(wid)}
            </span>
          ))}
          {effective.length === 0 && (
            <span className="text-sm text-slate-400">なし</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachTrackerCard({ onAttach }: { onAttach: () => void }) {
  return (
    <div className={CARD}>
      <h2 className="mb-2 font-semibold">tracker</h2>
      <p className="mb-3 text-sm text-slate-500">
        この pj には子pjがありません。tracker を付けると葉になり、issue・task
        を持てます。
      </p>
      <button onClick={onAttach} className={BTN}>
        tracker を付ける（葉にする）
      </button>
    </div>
  );
}

function TrackerCard({
  id,
  tracker,
  onDetach,
  onChange,
}: {
  id: string;
  tracker: Tracker;
  onDetach: () => void;
  onChange: (patch: { startDate?: string; endDate?: string }) => void;
}) {
  return (
    <div className={`${CARD} space-y-4`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">tracker（期間）</h2>
        <button onClick={onDetach} className={DEL}>
          tracker を外す
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>開始日</label>
          <input
            type="date"
            value={tracker.startDate ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ startDate: v === "" ? undefined : v });
            }}
            className={`w-full ${INPUT}`}
          />
        </div>
        <div>
          <label className={LABEL}>終了日</label>
          <input
            type="date"
            value={tracker.endDate ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ endDate: v === "" ? undefined : v });
            }}
            className={`w-full ${INPUT}`}
          />
        </div>
      </div>
      <div className="flex gap-4 text-sm">
        <Link
          href={`/pj/${id}/issues`}
          className="text-indigo-600 hover:underline"
        >
          issue 一覧へ →
        </Link>
        <Link
          href={`/pj/${id}/calendar`}
          className="text-indigo-600 hover:underline"
        >
          カレンダーへ →
        </Link>
      </div>
    </div>
  );
}

function ChildrenCard({
  childPjs,
  childName,
  setChildName,
  onAdd,
}: {
  childPjs: Pj[];
  childName: string;
  setChildName: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className={CARD}>
      <h2 className="mb-3 font-semibold">子pj（{childPjs.length}）</h2>
      <div className="mb-3 flex gap-2">
        <input
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          placeholder="子pj名"
          className={`flex-1 ${INPUT}`}
        />
        <button onClick={onAdd} className={BTN}>
          + 追加
        </button>
      </div>
      <div className="space-y-1">
        {childPjs.map((c) => (
          <Link
            key={c.id}
            href={`/pj/${c.id}`}
            className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-sm hover:bg-slate-50"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: c.color }}
            />
            <span className="font-medium text-slate-700">{c.name}</span>
          </Link>
        ))}
        {childPjs.length === 0 && (
          <p className="text-sm text-slate-400">子pjがありません。</p>
        )}
      </div>
    </div>
  );
}

export default function PjDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();

  const {
    pjs,
    pjMembers,
    trackers,
    workers,
    updatePj,
    removePj,
    addPjMember,
    removePjMember,
    attachTracker,
    updateTracker,
    detachTracker,
    addPj,
  } = useStore();

  const [childName, setChildName] = useState("");
  const [addMemberId, setAddMemberId] = useState("");

  const pj = pjs.find((p) => p.id === id);

  if (!pj) {
    return (
      <div className="space-y-3">
        <Link href="/pj" className="text-sm text-slate-500 hover:underline">
          ← プロジェクト一覧
        </Link>
        <p className="text-slate-400">ノードが見つかりません。</p>
      </div>
    );
  }

  const crumbs = breadcrumb(id, pjs);
  const children = childrenOf(id, pjs);
  const leaf = isLeaf(id, trackers);
  const tracker = trackers.find((t) => t.pjId === id);
  const contract = isContractNode(pj);
  const members = pjMembers.filter((m) => m.pjId === id);
  const effective = effectiveMembers(id, pjs, pjMembers);
  const candidateWorkers = workers.filter(
    (w) => !members.some((m) => m.workerId === w.id)
  );
  const workerName = (wid?: string) =>
    workers.find((w) => w.id === wid)?.name ?? "—";

  // tracker を付けられる = !leaf && children.length === 0
  // 子pjを追加できる    = !leaf
  const canAttachTracker = !leaf && children.length === 0;
  const canAddChild = !leaf;

  const del = async () => {
    if (
      !confirm(
        `「${pj.name}」を削除します。配下の子pj・tracker・issue・task もすべて削除されます。よろしいですか？`
      )
    )
      return;
    await removePj(id);
    router.push("/pj");
  };

  const addChild = async () => {
    if (!childName.trim()) return;
    await addPj({ name: childName, parentId: id });
    setChildName("");
  };

  const addMember = async () => {
    if (!addMemberId) return;
    await addPjMember(id, addMemberId);
    setAddMemberId("");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/pj" className="text-sm text-slate-500 hover:underline">
          ← プロジェクト一覧
        </Link>
        <button onClick={del} className={DEL}>
          この pj を削除
        </button>
      </div>

      <Breadcrumb crumbs={crumbs} id={id} />

      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: pj.color }}
        />
        <h1 className="text-xl font-bold">{pj.name}</h1>
        {contract && (
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

      <BasicInfoCard
        pj={pj}
        workers={workers}
        onChange={(patch) => updatePj(id, patch)}
      />

      <MembersCard
        members={members}
        effective={effective}
        candidateWorkers={candidateWorkers}
        workerName={workerName}
        addMemberId={addMemberId}
        setAddMemberId={setAddMemberId}
        onAdd={addMember}
        onRemove={(workerId) => removePjMember(id, workerId)}
      />

      {/* tracker を付けられる = !leaf && 子pjが0件 */}
      {canAttachTracker && (
        <AttachTrackerCard onAttach={() => attachTracker({ pjId: id })} />
      )}

      {/* tracker を持つノードにだけ：期間編集・外す・issue/calendar リンク */}
      {tracker && (
        <TrackerCard
          id={id}
          tracker={tracker}
          onDetach={() => detachTracker(id)}
          onChange={(patch) => updateTracker(id, patch)}
        />
      )}

      {/* 子pj追加（tracker を持たないノードにだけ） */}
      {canAddChild && (
        <ChildrenCard
          childPjs={children}
          childName={childName}
          setChildName={setChildName}
          onAdd={addChild}
        />
      )}
    </div>
  );
}
