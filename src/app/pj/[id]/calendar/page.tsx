"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { breadcrumb, isLeaf, effectiveMembers } from "@/lib/aggregate/tree";
import {
  plannedHoursOf,
  sumPlannedHours,
  tasksInYear,
} from "@/lib/aggregate/plan";
import type { Issue, Pj, Task, Worker } from "@/lib/types";
import { CARD, INPUT, LABEL, BTN, BTN_GHOST, DEL } from "@/lib/ui";

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO8601 → <input type="datetime-local"> が読めるローカル時刻文字列。 */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> のローカル時刻文字列 → ISO8601。不正なら undefined。 */
function localInputToIso(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** 表示用: ローカル時刻の "YYYY-MM-DD HH:mm"。 */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 日またぎ判定用: ローカル時刻の日付部分のみ。 */
function localDateOnly(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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

type TaskPatch = {
  title: string;
  startAt: string;
  endAt: string;
  assigneeId: string;
  issueId: string | undefined;
};

function TaskRow({
  task,
  workers,
  candidateWorkers,
  issues,
  onSave,
  onDelete,
}: {
  task: Task;
  workers: Worker[];
  candidateWorkers: Worker[];
  issues: Issue[];
  onSave: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [startLocal, setStartLocal] = useState(isoToLocalInput(task.startAt));
  const [endLocal, setEndLocal] = useState(isoToLocalInput(task.endAt));
  const [assigneeId, setAssigneeId] = useState(task.assigneeId);
  const [issueId, setIssueId] = useState(task.issueId ?? "");

  const overnight = localDateOnly(task.startAt) !== localDateOnly(task.endAt);
  const assigneeName =
    workers.find((w) => w.id === task.assigneeId)?.name ?? "—";
  const issueTitle = issues.find((i) => i.id === task.issueId)?.title;

  const cancel = () => {
    setTitle(task.title);
    setStartLocal(isoToLocalInput(task.startAt));
    setEndLocal(isoToLocalInput(task.endAt));
    setAssigneeId(task.assigneeId);
    setIssueId(task.issueId ?? "");
    setEditing(false);
  };

  const save = () => {
    const startAt = localInputToIso(startLocal);
    const endAt = localInputToIso(endLocal);
    if (!title.trim() || !startAt || !endAt || !assigneeId) return;
    onSave(task.id, {
      title,
      startAt,
      endAt,
      assigneeId,
      issueId: issueId || undefined,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2 border-b border-slate-100 py-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>開始日時</label>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className={`w-full ${INPUT}`}
            />
          </div>
          <div>
            <label className={LABEL}>終了日時</label>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className={`w-full ${INPUT}`}
            />
          </div>
        </div>
        <div>
          <label className={LABEL}>タイトル</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full ${INPUT}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>担当者</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={`w-full ${INPUT}`}
            >
              <option value="">選択してください</option>
              {candidateWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>紐づく issue</label>
            <select
              value={issueId}
              onChange={(e) => setIssueId(e.target.value)}
              className={`w-full ${INPUT}`}
            >
              <option value="">なし</option>
              {issues.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className={BTN}>
            保存
          </button>
          <button onClick={cancel} className={BTN_GHOST}>
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 border-b border-slate-100 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-slate-500">
          {fmtDateTime(task.startAt)} 〜 {fmtDateTime(task.endAt)}
        </span>
        <span className="font-medium text-slate-700">{task.title}</span>
        <span className="text-slate-500">{assigneeName}</span>
        <span className="font-medium text-indigo-600">
          {plannedHoursOf(task).toFixed(1)} h
        </span>
        {issueTitle && (
          <span className="text-xs text-slate-400">issue: {issueTitle}</span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setEditing(true)} className={BTN_GHOST}>
            編集
          </button>
          <button onClick={() => onDelete(task.id)} className={DEL}>
            削除
          </button>
        </div>
      </div>
      {overnight && (
        <p className="text-xs text-amber-600">
          日をまたぐ枠は夜間も工数に数えます
        </p>
      )}
    </div>
  );
}

function NewTaskCard({
  candidateWorkers,
  issues,
  pjId,
  onAdd,
}: {
  candidateWorkers: Worker[];
  issues: Issue[];
  pjId: string;
  onAdd: (input: {
    title: string;
    startAt: string;
    endAt: string;
    assigneeId: string;
    issueId: string | undefined;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [issueId, setIssueId] = useState("");

  const noMembers = candidateWorkers.length === 0;

  const submit = () => {
    const startAt = localInputToIso(startLocal);
    const endAt = localInputToIso(endLocal);
    if (!title.trim() || !startAt || !endAt || !assigneeId) return;
    onAdd({ title, startAt, endAt, assigneeId, issueId: issueId || undefined });
    setTitle("");
    setStartLocal("");
    setEndLocal("");
    setAssigneeId("");
    setIssueId("");
  };

  return (
    <div className={`${CARD} space-y-3`}>
      <h2 className="font-semibold">新規 task</h2>

      {noMembers ? (
        <p className="text-sm text-amber-600">
          この pj に有効メンバーがいません。
          <Link href={`/pj/${pjId}`} className="underline">
            /pj/{pjId}
          </Link>
          でメンバーを追加してください。
        </p>
      ) : (
        <>
          <div>
            <label className={LABEL}>タイトル</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="task のタイトル"
              className={`w-full ${INPUT}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>開始日時</label>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className={`w-full ${INPUT}`}
              />
            </div>
            <div>
              <label className={LABEL}>終了日時</label>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className={`w-full ${INPUT}`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>担当者</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={`w-full ${INPUT}`}
              >
                <option value="">選択してください</option>
                {candidateWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>紐づく issue（任意）</label>
              <select
                value={issueId}
                onChange={(e) => setIssueId(e.target.value)}
                className={`w-full ${INPUT}`}
              >
                <option value="">なし</option>
                {issues.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            予定工数は開始〜終了の枠の長さから自動的に決まります（入力欄はありません）。
          </p>
          <button
            onClick={submit}
            disabled={!title.trim() || !startLocal || !endLocal || !assigneeId}
            className={BTN}
          >
            + 追加
          </button>
        </>
      )}
    </div>
  );
}

export default function PjCalendarPage() {
  const params = useParams();
  const id = String(params.id);

  const {
    pjs,
    pjMembers,
    trackers,
    tasks,
    issues,
    workers,
    year,
    addTask,
    updateTask,
    removeTask,
  } = useStore();

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
          この pj は葉ではないため task を持てません。
        </p>
      </div>
    );
  }

  const pjTasks = tasks.filter((t) => t.trackerPjId === id);
  const pjIssues = issues.filter((i) => i.trackerPjId === id);
  const yearTasks = tasksInYear(pjTasks, year);
  const sorted = [...yearTasks].sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)
  );

  const groups = new Map<number, Task[]>();
  for (const t of sorted) {
    const m = new Date(t.startAt).getMonth() + 1;
    const bucket = groups.get(m);
    if (bucket) bucket.push(t);
    else groups.set(m, [t]);
  }
  const monthKeys = Array.from(groups.keys()).sort((a, b) => a - b);

  const candidateWorkerIds = new Set(effectiveMembers(id, pjs, pjMembers));
  const candidateWorkers = workers.filter((w) => candidateWorkerIds.has(w.id));

  const addNewTask = (input: {
    title: string;
    startAt: string;
    endAt: string;
    assigneeId: string;
    issueId: string | undefined;
  }) => {
    addTask({ trackerPjId: id, ...input });
  };

  const saveTask = (taskId: string, patch: TaskPatch) => {
    updateTask(taskId, patch);
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

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {pj.name} のカレンダー（{year}）
        </h1>
        <span className="text-sm text-slate-500">
          予定工数 合計:{" "}
          <span className="font-semibold text-indigo-600">
            {sumPlannedHours(yearTasks).toFixed(1)} h
          </span>
        </span>
      </div>

      <NewTaskCard
        candidateWorkers={candidateWorkers}
        issues={pjIssues}
        pjId={id}
        onAdd={addNewTask}
      />

      <div className={CARD}>
        <h2 className="mb-2 font-semibold">task 一覧（{sorted.length}）</h2>
        {monthKeys.length === 0 ? (
          <p className="text-sm text-slate-400">
            {year}年の task がありません。
          </p>
        ) : (
          monthKeys.map((m) => (
            <div key={m} className="mb-4 last:mb-0">
              <h3 className="mb-1 text-sm font-semibold text-slate-500">
                {m}月
              </h3>
              {(groups.get(m) ?? []).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  workers={workers}
                  candidateWorkers={candidateWorkers}
                  issues={pjIssues}
                  onSave={saveTask}
                  onDelete={removeTask}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
