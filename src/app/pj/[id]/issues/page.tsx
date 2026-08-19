"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { breadcrumb, isLeaf } from "@/lib/aggregate/tree";
import type { Issue, Pj, Worker } from "@/lib/types";
import { CARD, INPUT, LABEL, BTN, DEL } from "@/lib/ui";

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

function IssueRow({
  issue,
  depth,
  childrenOfIssue,
  workers,
  onToggleStatus,
  onAssigneeChange,
  onDelete,
}: {
  issue: Issue;
  depth: number;
  childrenOfIssue: (parentId: string) => Issue[];
  workers: Worker[];
  onToggleStatus: (issue: Issue) => void;
  onAssigneeChange: (issue: Issue, assigneeId: string) => void;
  onDelete: (issue: Issue) => void;
}) {
  const closed = issue.status === "closed";
  const children = childrenOfIssue(issue.id);

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 text-sm"
        style={{ paddingLeft: depth * 20 }}
      >
        <button
          onClick={() => onToggleStatus(issue)}
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            closed
              ? "bg-slate-100 text-slate-500"
              : "bg-indigo-50 text-indigo-700"
          }`}
        >
          {issue.status}
        </button>
        <span
          className={`flex-1 min-w-[8rem] ${
            closed ? "text-slate-400 line-through" : "text-slate-700"
          }`}
        >
          {issue.title}
        </span>
        <select
          value={issue.assigneeId ?? ""}
          onChange={(e) => onAssigneeChange(issue, e.target.value)}
          className={INPUT}
        >
          <option value="">未アサイン</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <span className="w-24 text-xs text-slate-400">
          {issue.dueDate ?? "期日なし"}
        </span>
        <button onClick={() => onDelete(issue)} className={DEL}>
          削除
        </button>
      </div>
      {children.map((child) => (
        <IssueRow
          key={child.id}
          issue={child}
          depth={depth + 1}
          childrenOfIssue={childrenOfIssue}
          workers={workers}
          onToggleStatus={onToggleStatus}
          onAssigneeChange={onAssigneeChange}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function NewIssueCard({
  workers,
  parentCandidates,
  onAdd,
}: {
  workers: Worker[];
  parentCandidates: Issue[];
  onAdd: (input: {
    title: string;
    dueDate: string;
    assigneeId: string;
    parentId: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [parentId, setParentId] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title, dueDate, assigneeId, parentId });
    setTitle("");
    setDueDate("");
    setAssigneeId("");
    setParentId("");
  };

  return (
    <div className={`${CARD} space-y-3`}>
      <h2 className="font-semibold">新規 issue</h2>
      <div>
        <label className={LABEL}>タイトル</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="issue のタイトル"
          className={`w-full ${INPUT}`}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>期日（任意）</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`w-full ${INPUT}`}
          />
        </div>
        <div>
          <label className={LABEL}>担当者（任意）</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className={`w-full ${INPUT}`}
          >
            <option value="">未アサイン</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={LABEL}>親issue（任意）</label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className={`w-full ${INPUT}`}
        >
          <option value="">なし（ルート）</option>
          {parentCandidates.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>
      </div>
      <button onClick={submit} className={BTN}>
        + 追加
      </button>
    </div>
  );
}

export default function PjIssuesPage() {
  const params = useParams();
  const id = String(params.id);

  const { pjs, trackers, issues, workers, addIssue, updateIssue, removeIssue } =
    useStore();

  const pj = pjs.find((p) => p.id === id);
  const crumbs = breadcrumb(id, pjs);
  const leaf = isLeaf(id, trackers);

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

  if (!leaf) {
    return (
      <div className="space-y-3">
        <Link
          href={`/pj/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {pj.name}
        </Link>
        <Breadcrumb crumbs={crumbs} id={id} />
        <p className={`${CARD} text-slate-400`}>
          この pj は葉ではないため issue を持てません。
        </p>
      </div>
    );
  }

  const pjIssues = issues.filter((i) => i.trackerPjId === id);
  const roots = pjIssues.filter((i) => i.parentId == null);
  const childrenOfIssue = (parentId: string) =>
    pjIssues.filter((i) => i.parentId === parentId);

  const toggleStatus = (issue: Issue) => {
    updateIssue(issue.id, {
      status: issue.status === "open" ? "closed" : "open",
    });
  };

  const changeAssignee = (issue: Issue, assigneeId: string) => {
    updateIssue(issue.id, { assigneeId: assigneeId || undefined });
  };

  const deleteIssue = (issue: Issue) => {
    removeIssue(issue.id);
  };

  const addNewIssue = (input: {
    title: string;
    dueDate: string;
    assigneeId: string;
    parentId: string;
  }) => {
    addIssue({
      trackerPjId: id,
      title: input.title,
      dueDate: input.dueDate || undefined,
      assigneeId: input.assigneeId || undefined,
      parentId: input.parentId || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <Link
        href={`/pj/${id}`}
        className="text-sm text-slate-500 hover:underline"
      >
        ← {pj.name}
      </Link>

      <Breadcrumb crumbs={crumbs} id={id} />

      <h1 className="text-xl font-bold">{pj.name} のバックログ</h1>

      <NewIssueCard
        workers={workers}
        parentCandidates={pjIssues}
        onAdd={addNewIssue}
      />

      <div className={CARD}>
        <h2 className="mb-2 font-semibold">issue 一覧（{pjIssues.length}）</h2>
        {roots.length === 0 ? (
          <p className="text-sm text-slate-400">issue がありません。</p>
        ) : (
          <div>
            {roots.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                depth={0}
                childrenOfIssue={childrenOfIssue}
                workers={workers}
                onToggleStatus={toggleStatus}
                onAssigneeChange={changeAssignee}
                onDelete={deleteIssue}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
