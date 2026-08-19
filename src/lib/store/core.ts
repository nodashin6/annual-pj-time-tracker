"use client";

import type { StateCreator } from "zustand";
import { supabase } from "../supabase";
import type {
  DbWorker,
  DbPj,
  DbPjMember,
  DbTracker,
  DbIssue,
  DbTask,
} from "../supabase";
import type { Worker, Pj, PjMember, Tracker, Issue, Task } from "../types";
import {
  workerInputSchema,
  pjInputSchema,
  pjPatchSchema,
  trackerInputSchema,
  trackerPatchSchema,
  issueInputSchema,
  issuePatchSchema,
  taskInputSchema,
  taskPatchSchema,
} from "../schemas";
import { mergeTrackerDates, mergeTaskDates } from "./validate";
import type { PjInput, TrackerInput, IssueInput, TaskInput } from "../schemas";
import {
  toWorker,
  toPj,
  toPjMember,
  toTracker,
  toIssue,
  toTask,
} from "./mappers";
import { fail, check, patchOf } from "./crud";
import { notify } from "../notify";
import { PALETTE } from "../ui";
import type { Shared } from "./types";
// removePj / detachTracker が taskEntries も掃除するため、実績スライスの型が要る。
// 型のみの import なので循環参照にはならない。
import type { ActualsSlice } from "./actuals";

export type CoreState = {
  workers: Worker[];
  pjs: Pj[];
  pjMembers: PjMember[];
  trackers: Tracker[];
  issues: Issue[];
  tasks: Task[];
};

export type CoreActions = {
  addWorker: (input: { name: string }) => Promise<void>;
  updateWorker: (id: string, patch: { name?: string }) => Promise<void>;
  removeWorker: (id: string) => Promise<void>;

  addPj: (input: PjInput) => Promise<string | undefined>;
  updatePj: (id: string, patch: Partial<PjInput>) => Promise<void>;
  removePj: (id: string) => Promise<void>;

  addPjMember: (pjId: string, workerId: string) => Promise<void>;
  removePjMember: (pjId: string, workerId: string) => Promise<void>;

  attachTracker: (input: TrackerInput) => Promise<void>;
  updateTracker: (pjId: string, patch: Partial<TrackerInput>) => Promise<void>;
  detachTracker: (pjId: string) => Promise<void>;

  addIssue: (input: IssueInput) => Promise<string | undefined>;
  updateIssue: (id: string, patch: Partial<IssueInput>) => Promise<void>;
  removeIssue: (id: string) => Promise<void>;

  addTask: (input: TaskInput) => Promise<string | undefined>;
  updateTask: (id: string, patch: Partial<TaskInput>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
};

export type CoreSlice = CoreState & CoreActions;

export const createCoreSlice: StateCreator<
  CoreSlice & ActualsSlice & Shared,
  [],
  [],
  CoreSlice
> = (set, get) => ({
  workers: [],
  pjs: [],
  pjMembers: [],
  trackers: [],
  issues: [],
  tasks: [],

  // ---- Workers ----
  addWorker: async (input) => {
    if (!supabase) return;
    const v = check(workerInputSchema, input);
    if (!v) return;
    try {
      const { data, error } = await supabase
        .from("workers")
        .insert({ name: v.name })
        .select()
        .single();
      if (error) throw error;
      set({ workers: [...get().workers, toWorker(data as DbWorker)] });
    } catch (e) {
      fail(set, e);
    }
  },
  updateWorker: async (id, patch) => {
    if (!supabase) return;
    const v = check(workerInputSchema.partial(), patch);
    if (!v) return;
    const prev = get().workers;
    set({ workers: prev.map((w) => (w.id === id ? { ...w, ...v } : w)) });
    try {
      const { error } = await supabase
        .from("workers")
        .update(patchOf({ name: v.name }))
        .eq("id", id);
      if (error) throw error;
    } catch (e) {
      set({ workers: prev });
      fail(set, e);
    }
  },
  removeWorker: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("workers").delete().eq("id", id);
      if (error) throw error;
      // DB は pj.owner_worker_id / issues.assignee_id を on delete set null に
      // しているので、ローカルも同じ範囲を undefined（宙ぶらりん）に落とす。
      set({
        workers: get().workers.filter((w) => w.id !== id),
        pjMembers: get().pjMembers.filter((m) => m.workerId !== id),
        pjs: get().pjs.map((p) =>
          p.ownerWorkerId === id ? { ...p, ownerWorkerId: undefined } : p
        ),
        issues: get().issues.map((i) =>
          i.assigneeId === id ? { ...i, assigneeId: undefined } : i
        ),
      });
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- pj ----
  addPj: async (input) => {
    if (!supabase) return undefined;
    const v = check(pjInputSchema, input);
    if (!v) return undefined;
    try {
      const color = v.color || PALETTE[get().pjs.length % PALETTE.length];
      const { data, error } = await supabase
        .from("pj")
        .insert({
          parent_id: v.parentId ?? null,
          name: v.name,
          color,
          owner_worker_id: v.ownerWorkerId ?? null,
          fiscal_year: v.fiscalYear ?? null,
          budget_amount: v.budgetAmount ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const created = toPj(data as DbPj);
      set({ pjs: [...get().pjs, created] });
      return created.id;
    } catch (e) {
      fail(set, e);
      return undefined;
    }
  },
  updatePj: async (id, patch) => {
    if (!supabase) return;
    const v = check(pjPatchSchema, patch);
    if (!v) return;
    // color は NOT NULL でクリア不可のため空文字は「変更しない」として扱う。
    // ローカル・DB の両方で patch から color キーごと除いて解釈する。
    const { color, ...rest } = v;
    const localPatch = color ? { ...rest, color } : rest;
    const prev = get().pjs;
    set({ pjs: prev.map((p) => (p.id === id ? { ...p, ...localPatch } : p)) });
    try {
      const { error } = await supabase
        .from("pj")
        .update(
          patchOf({
            parent_id: "parentId" in v ? (v.parentId ?? null) : undefined,
            name: v.name,
            color: color || undefined,
            owner_worker_id:
              "ownerWorkerId" in v ? (v.ownerWorkerId ?? null) : undefined,
            fiscal_year: "fiscalYear" in v ? (v.fiscalYear ?? null) : undefined,
            budget_amount:
              "budgetAmount" in v ? (v.budgetAmount ?? null) : undefined,
          })
        )
        .eq("id", id);
      if (error) throw error;
    } catch (e) {
      set({ pjs: prev });
      fail(set, e);
    }
  },
  removePj: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("pj").delete().eq("id", id);
      if (error) throw error;
      // DB 側は cascade で子孫まで消える。ローカル状態も同じ範囲を落とす。
      const gone = new Set<string>();
      const walk = (pid: string) => {
        gone.add(pid);
        for (const c of get().pjs) if (c.parentId === pid) walk(c.id);
      };
      walk(id);
      const goneTasks = new Set(
        get()
          .tasks.filter((t) => gone.has(t.trackerPjId))
          .map((t) => t.id)
      );
      set({
        pjs: get().pjs.filter((p) => !gone.has(p.id)),
        pjMembers: get().pjMembers.filter((m) => !gone.has(m.pjId)),
        trackers: get().trackers.filter((t) => !gone.has(t.pjId)),
        issues: get().issues.filter((i) => !gone.has(i.trackerPjId)),
        tasks: get().tasks.filter((t) => !gone.has(t.trackerPjId)),
        taskEntries: get().taskEntries.filter((e) => !goneTasks.has(e.taskId)),
      });
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- pj_members ----
  addPjMember: async (pjId, workerId) => {
    if (!supabase) return;
    if (get().pjMembers.some((m) => m.pjId === pjId && m.workerId === workerId))
      return;
    try {
      const { data, error } = await supabase
        .from("pj_members")
        .insert({ pj_id: pjId, worker_id: workerId })
        .select()
        .single();
      if (error) throw error;
      set({ pjMembers: [...get().pjMembers, toPjMember(data as DbPjMember)] });
    } catch (e) {
      fail(set, e);
    }
  },
  removePjMember: async (pjId, workerId) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from("pj_members")
        .delete()
        .match({ pj_id: pjId, worker_id: workerId });
      if (error) throw error;
      set({
        pjMembers: get().pjMembers.filter(
          (m) => !(m.pjId === pjId && m.workerId === workerId)
        ),
      });
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- tracker（葉の印） ----
  attachTracker: async (input) => {
    if (!supabase) return;
    const v = check(trackerInputSchema, input);
    if (!v) return;
    try {
      const { data, error } = await supabase
        .from("tracker")
        .insert({
          pj_id: v.pjId,
          start_date: v.startDate ?? null,
          end_date: v.endDate ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      set({ trackers: [...get().trackers, toTracker(data as DbTracker)] });
    } catch (e) {
      fail(set, e);
    }
  },
  updateTracker: async (pjId, patch) => {
    if (!supabase) return;
    const v = check(trackerPatchSchema, patch);
    if (!v) return;
    // trackerPatchSchema は .partial() で startDate <= endDate の refine が
    // 落ちているため、既存の tracker とマージした値で同じ検証を再現する
    // （mergeTrackerDates。store/validate.ts、テストは validate.test.ts）。
    const current = get().trackers.find((t) => t.pjId === pjId);
    const merged = mergeTrackerDates(current, v);
    if (!merged.ok) {
      notify.error(merged.message);
      return;
    }
    const prev = get().trackers;
    set({
      trackers: prev.map((t) => (t.pjId === pjId ? { ...t, ...v } : t)),
    });
    try {
      const { error } = await supabase
        .from("tracker")
        .update(
          patchOf({
            start_date: "startDate" in v ? (v.startDate ?? null) : undefined,
            end_date: "endDate" in v ? (v.endDate ?? null) : undefined,
          })
        )
        .eq("pj_id", pjId);
      if (error) throw error;
    } catch (e) {
      set({ trackers: prev });
      fail(set, e);
    }
  },
  detachTracker: async (pjId) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from("tracker")
        .delete()
        .eq("pj_id", pjId);
      if (error) throw error;
      const goneTasks = new Set(
        get()
          .tasks.filter((t) => t.trackerPjId === pjId)
          .map((t) => t.id)
      );
      set({
        trackers: get().trackers.filter((t) => t.pjId !== pjId),
        issues: get().issues.filter((i) => i.trackerPjId !== pjId),
        tasks: get().tasks.filter((t) => t.trackerPjId !== pjId),
        taskEntries: get().taskEntries.filter((e) => !goneTasks.has(e.taskId)),
      });
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- issues ----
  addIssue: async (input) => {
    if (!supabase) return undefined;
    const v = check(issueInputSchema, input);
    if (!v) return undefined;
    try {
      const { data, error } = await supabase
        .from("issues")
        .insert({
          tracker_pj_id: v.trackerPjId,
          parent_id: v.parentId ?? null,
          assignee_id: v.assigneeId ?? null,
          title: v.title,
          due_date: v.dueDate ?? null,
          status: v.status,
        })
        .select()
        .single();
      if (error) throw error;
      const created = toIssue(data as DbIssue);
      set({ issues: [...get().issues, created] });
      return created.id;
    } catch (e) {
      fail(set, e);
      return undefined;
    }
  },
  updateIssue: async (id, patch) => {
    if (!supabase) return;
    const v = check(issuePatchSchema, patch);
    if (!v) return;
    const prev = get().issues;
    set({ issues: prev.map((i) => (i.id === id ? { ...i, ...v } : i)) });
    try {
      const { error } = await supabase
        .from("issues")
        .update(
          patchOf({
            parent_id: "parentId" in v ? (v.parentId ?? null) : undefined,
            assignee_id: "assigneeId" in v ? (v.assigneeId ?? null) : undefined,
            title: v.title,
            due_date: "dueDate" in v ? (v.dueDate ?? null) : undefined,
            status: v.status,
          })
        )
        .eq("id", id);
      if (error) throw error;
    } catch (e) {
      set({ issues: prev });
      fail(set, e);
    }
  },
  removeIssue: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("issues").delete().eq("id", id);
      if (error) throw error;
      // DB は on delete cascade で子孫 issue まで消えるので、ローカルも同じ範囲を落とす。
      const gone = new Set<string>();
      const walk = (iid: string) => {
        gone.add(iid);
        for (const c of get().issues) if (c.parentId === iid) walk(c.id);
      };
      walk(id);
      set({
        issues: get().issues.filter((i) => !gone.has(i.id)),
        // issue 削除で task.issue_id は on delete set null になる
        tasks: get().tasks.map((t) =>
          t.issueId != null && gone.has(t.issueId)
            ? { ...t, issueId: undefined }
            : t
        ),
      });
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- tasks ----
  addTask: async (input) => {
    if (!supabase) return undefined;
    const v = check(taskInputSchema, input);
    if (!v) return undefined;
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          tracker_pj_id: v.trackerPjId,
          issue_id: v.issueId ?? null,
          assignee_id: v.assigneeId,
          title: v.title,
          start_at: v.startAt,
          end_at: v.endAt,
        })
        .select()
        .single();
      if (error) throw error;
      const created = toTask(data as DbTask);
      set({ tasks: [...get().tasks, created] });
      return created.id;
    } catch (e) {
      fail(set, e);
      return undefined;
    }
  },
  updateTask: async (id, patch) => {
    if (!supabase) return;
    const v = check(taskPatchSchema, patch);
    if (!v) return;
    // taskPatchSchema は .partial() で startAt < endAt の refine が落ちている
    // ため、既存の task とマージした値で同じ検証を再現する
    // （mergeTaskDates。store/validate.ts、テストは validate.test.ts）。
    const current = get().tasks.find((t) => t.id === id);
    const merged = mergeTaskDates(current, v);
    if (!merged.ok) {
      notify.error(merged.message);
      return;
    }
    const prev = get().tasks;
    set({ tasks: prev.map((t) => (t.id === id ? { ...t, ...v } : t)) });
    try {
      const { error } = await supabase
        .from("tasks")
        .update(
          patchOf({
            issue_id: "issueId" in v ? (v.issueId ?? null) : undefined,
            assignee_id: v.assigneeId,
            title: v.title,
            start_at: v.startAt,
            end_at: v.endAt,
          })
        )
        .eq("id", id);
      if (error) throw error;
    } catch (e) {
      set({ tasks: prev });
      fail(set, e);
    }
  },
  removeTask: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      set({
        tasks: get().tasks.filter((t) => t.id !== id),
        taskEntries: get().taskEntries.filter((e) => e.taskId !== id),
      });
    } catch (e) {
      fail(set, e);
    }
  },
});
