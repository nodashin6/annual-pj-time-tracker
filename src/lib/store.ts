"use client";

import { create } from "zustand";
import type {
  Team,
  Worker,
  Client,
  Order,
  Project,
  Milestone,
  Assignment,
  Achievement,
  Entry,
} from "./types";
import {
  supabase,
  isSupabaseConfigured,
  type DbTeam,
  type DbWorker,
  type DbClient,
  type DbOrder,
  type DbProject,
  type DbMilestone,
  type DbAssignment,
  type DbAchievement,
  type DbEntry,
} from "./supabase";

const PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6",
];

const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : Number(v);

// ---- マッピング (snake_case DB <-> camelCase app) ----
const toTeam = (r: DbTeam): Team => ({ id: r.id, name: r.name });
const toWorker = (r: DbWorker): Worker => ({
  id: r.id,
  name: r.name,
  monthlyCapacityHours: r.monthly_capacity_hours,
});
const toClient = (r: DbClient): Client => ({ id: r.id, name: r.name });
const toOrder = (r: DbOrder): Order => ({
  id: r.id,
  clientId: r.client_id ?? undefined,
  name: r.name,
  fiscalYear: r.fiscal_year ?? undefined,
  ownerWorkerId: r.owner_worker_id ?? undefined,
  plannedHours: num(r.planned_hours),
  budgetAmount: r.budget_amount == null ? undefined : num(r.budget_amount),
});
const toProject = (r: DbProject): Project => ({
  id: r.id,
  orderId: r.order_id,
  teamId: r.team_id ?? undefined,
  name: r.name,
  color: r.color,
});
const toMilestone = (r: DbMilestone): Milestone => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name ?? undefined,
  startDate: r.start_date,
  endDate: r.end_date,
});
const toAssignment = (r: DbAssignment): Assignment => ({
  id: r.id,
  workerId: r.worker_id,
  projectId: r.project_id,
});
const toAchievement = (r: DbAchievement): Achievement => ({
  id: r.id,
  assignmentId: r.assignment_id,
  milestoneId: r.milestone_id,
  allowedHours: num(r.allowed_hours),
});
const toEntry = (r: DbEntry): Entry => ({
  id: r.id,
  workerId: r.worker_id,
  projectId: r.project_id,
  year: r.year,
  month: r.month,
  hours: num(r.hours),
});

type Status = "idle" | "loading" | "ready" | "unconfigured" | "error";

type State = {
  teams: Team[];
  workers: Worker[];
  clients: Client[];
  orders: Order[];
  projects: Project[];
  milestones: Milestone[];
  assignments: Assignment[];
  achievements: Achievement[];
  entries: Entry[];
  year: number;
  status: Status;
  error: string | null;
  loaded: boolean;
};

type Actions = {
  load: () => Promise<void>;
  setYear: (year: number) => void;

  addWorker: (w: Omit<Worker, "id">) => Promise<void>;
  updateWorker: (id: string, patch: Partial<Omit<Worker, "id">>) => Promise<void>;
  removeWorker: (id: string) => Promise<void>;

  addTeam: (t: Omit<Team, "id">) => Promise<void>;
  updateTeam: (id: string, patch: Partial<Omit<Team, "id">>) => Promise<void>;
  removeTeam: (id: string) => Promise<void>;

  addClient: (c: Omit<Client, "id">) => Promise<void>;
  updateClient: (id: string, patch: Partial<Omit<Client, "id">>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;

  addOrder: (o: Omit<Order, "id">) => Promise<void>;
  updateOrder: (id: string, patch: Partial<Omit<Order, "id">>) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;

  addProject: (p: Omit<Project, "id">) => Promise<void>;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;

  addAssignment: (workerId: string, projectId: string) => Promise<void>;
  removeAssignment: (id: string) => Promise<void>;

  setHours: (args: {
    workerId: string;
    projectId: string;
    year: number;
    month: number;
    hours: number;
  }) => Promise<void>;
};

function fail(set: (p: Partial<State>) => void, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  set({ status: "error", error: msg });
  // eslint-disable-next-line no-console
  console.error("[store]", msg);
}

export const useStore = create<State & Actions>()((set, get) => ({
  teams: [],
  workers: [],
  clients: [],
  orders: [],
  projects: [],
  milestones: [],
  assignments: [],
  achievements: [],
  entries: [],
  year: new Date().getFullYear(),
  status: "idle",
  error: null,
  loaded: false,

  load: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ status: "unconfigured", loaded: true });
      return;
    }
    set({ status: "loading" });
    try {
      const [
        teamRes,
        workerRes,
        clientRes,
        orderRes,
        projectRes,
        milestoneRes,
        assignmentRes,
        achievementRes,
        entryRes,
      ] = await Promise.all([
        supabase.from("teams").select("*").order("created_at"),
        supabase.from("workers").select("*").order("created_at"),
        supabase.from("clients").select("*").order("created_at"),
        supabase.from("orders").select("*").order("created_at"),
        supabase.from("projects").select("*").order("created_at"),
        supabase.from("milestones").select("*").order("start_date"),
        supabase.from("assignments").select("*").order("created_at"),
        supabase.from("achievements").select("*").order("created_at"),
        supabase.from("entries").select("*"),
      ]);
      for (const r of [
        teamRes, workerRes, clientRes, orderRes, projectRes,
        milestoneRes, assignmentRes, achievementRes, entryRes,
      ]) {
        if (r.error) throw r.error;
      }
      set({
        teams: (teamRes.data as DbTeam[]).map(toTeam),
        workers: (workerRes.data as DbWorker[]).map(toWorker),
        clients: (clientRes.data as DbClient[]).map(toClient),
        orders: (orderRes.data as DbOrder[]).map(toOrder),
        projects: (projectRes.data as DbProject[]).map(toProject),
        milestones: (milestoneRes.data as DbMilestone[]).map(toMilestone),
        assignments: (assignmentRes.data as DbAssignment[]).map(toAssignment),
        achievements: (achievementRes.data as DbAchievement[]).map(toAchievement),
        entries: (entryRes.data as DbEntry[]).map(toEntry),
        status: "ready",
        error: null,
        loaded: true,
      });
    } catch (e) {
      fail(set, e);
    }
  },

  setYear: (year) => set({ year }),

  // ---- Workers ----
  addWorker: async (w) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("workers")
        .insert({ name: w.name, monthly_capacity_hours: w.monthlyCapacityHours })
        .select()
        .single();
      if (error) throw error;
      set((s) => ({ workers: [...s.workers, toWorker(data as DbWorker)] }));
    } catch (e) {
      fail(set, e);
    }
  },
  updateWorker: async (id, patch) => {
    if (!supabase) return;
    const prev = get().workers;
    set({ workers: prev.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
    try {
      const db: Record<string, unknown> = {};
      if (patch.name !== undefined) db.name = patch.name;
      if (patch.monthlyCapacityHours !== undefined)
        db.monthly_capacity_hours = patch.monthlyCapacityHours;
      const { error } = await supabase.from("workers").update(db).eq("id", id);
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
      set((s) => ({
        workers: s.workers.filter((w) => w.id !== id),
        entries: s.entries.filter((e) => e.workerId !== id),
        assignments: s.assignments.filter((a) => a.workerId !== id),
      }));
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- Teams ----
  addTeam: async (t) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert({ name: t.name })
        .select()
        .single();
      if (error) throw error;
      set((s) => ({ teams: [...s.teams, toTeam(data as DbTeam)] }));
    } catch (e) {
      fail(set, e);
    }
  },
  updateTeam: async (id, patch) => {
    if (!supabase) return;
    const prev = get().teams;
    set({ teams: prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
    try {
      const { error } = await supabase
        .from("teams")
        .update({ name: patch.name })
        .eq("id", id);
      if (error) throw error;
    } catch (e) {
      set({ teams: prev });
      fail(set, e);
    }
  },
  removeTeam: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
      set((s) => ({
        teams: s.teams.filter((t) => t.id !== id),
        projects: s.projects.map((p) =>
          p.teamId === id ? { ...p, teamId: undefined } : p
        ),
      }));
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- Clients ----
  addClient: async (c) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({ name: c.name })
        .select()
        .single();
      if (error) throw error;
      set((s) => ({ clients: [...s.clients, toClient(data as DbClient)] }));
    } catch (e) {
      fail(set, e);
    }
  },
  updateClient: async (id, patch) => {
    if (!supabase) return;
    const prev = get().clients;
    set({ clients: prev.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    try {
      const { error } = await supabase
        .from("clients")
        .update({ name: patch.name })
        .eq("id", id);
      if (error) throw error;
    } catch (e) {
      set({ clients: prev });
      fail(set, e);
    }
  },
  removeClient: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      set((s) => ({
        clients: s.clients.filter((c) => c.id !== id),
        orders: s.orders.map((o) =>
          o.clientId === id ? { ...o, clientId: undefined } : o
        ),
      }));
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- Orders ----
  addOrder: async (o) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          client_id: o.clientId ?? null,
          name: o.name,
          fiscal_year: o.fiscalYear ?? null,
          owner_worker_id: o.ownerWorkerId ?? null,
          planned_hours: o.plannedHours ?? 0,
          budget_amount: o.budgetAmount ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      set((s) => ({ orders: [...s.orders, toOrder(data as DbOrder)] }));
    } catch (e) {
      fail(set, e);
    }
  },
  updateOrder: async (id, patch) => {
    if (!supabase) return;
    const prev = get().orders;
    set({ orders: prev.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
    try {
      const db: Record<string, unknown> = {};
      if (patch.clientId !== undefined) db.client_id = patch.clientId ?? null;
      if (patch.name !== undefined) db.name = patch.name;
      if (patch.fiscalYear !== undefined) db.fiscal_year = patch.fiscalYear ?? null;
      if (patch.ownerWorkerId !== undefined)
        db.owner_worker_id = patch.ownerWorkerId ?? null;
      if (patch.plannedHours !== undefined) db.planned_hours = patch.plannedHours;
      if (patch.budgetAmount !== undefined)
        db.budget_amount = patch.budgetAmount ?? null;
      const { error } = await supabase.from("orders").update(db).eq("id", id);
      if (error) throw error;
    } catch (e) {
      set({ orders: prev });
      fail(set, e);
    }
  },
  removeOrder: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
      // orders 削除は projects -> entries/assignments まで cascade する
      set((s) => {
        const removedProjects = s.projects
          .filter((p) => p.orderId === id)
          .map((p) => p.id);
        const rp = new Set(removedProjects);
        return {
          orders: s.orders.filter((o) => o.id !== id),
          projects: s.projects.filter((p) => p.orderId !== id),
          entries: s.entries.filter((e) => !rp.has(e.projectId)),
          assignments: s.assignments.filter((a) => !rp.has(a.projectId)),
          milestones: s.milestones.filter((m) => !rp.has(m.projectId)),
        };
      });
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- Projects ----
  addProject: async (p) => {
    if (!supabase) return;
    try {
      const color = p.color || PALETTE[get().projects.length % PALETTE.length];
      const { data, error } = await supabase
        .from("projects")
        .insert({
          order_id: p.orderId,
          team_id: p.teamId ?? null,
          name: p.name,
          color,
        })
        .select()
        .single();
      if (error) throw error;
      set((s) => ({ projects: [...s.projects, toProject(data as DbProject)] }));
    } catch (e) {
      fail(set, e);
    }
  },
  updateProject: async (id, patch) => {
    if (!supabase) return;
    const prev = get().projects;
    set({ projects: prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    try {
      const db: Record<string, unknown> = {};
      if (patch.orderId !== undefined) db.order_id = patch.orderId;
      if (patch.teamId !== undefined) db.team_id = patch.teamId ?? null;
      if (patch.name !== undefined) db.name = patch.name;
      if (patch.color !== undefined) db.color = patch.color;
      const { error } = await supabase.from("projects").update(db).eq("id", id);
      if (error) throw error;
    } catch (e) {
      set({ projects: prev });
      fail(set, e);
    }
  },
  removeProject: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        entries: s.entries.filter((e) => e.projectId !== id),
        assignments: s.assignments.filter((a) => a.projectId !== id),
        milestones: s.milestones.filter((m) => m.projectId !== id),
      }));
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- Assignments (worker × project) ----
  addAssignment: async (workerId, projectId) => {
    if (!supabase) return;
    if (
      get().assignments.some(
        (a) => a.workerId === workerId && a.projectId === projectId
      )
    )
      return;
    try {
      const { data, error } = await supabase
        .from("assignments")
        .insert({ worker_id: workerId, project_id: projectId })
        .select()
        .single();
      if (error) throw error;
      set((s) => ({
        assignments: [...s.assignments, toAssignment(data as DbAssignment)],
      }));
    } catch (e) {
      fail(set, e);
    }
  },
  removeAssignment: async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
      set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) }));
    } catch (e) {
      fail(set, e);
    }
  },

  // ---- Entries ----
  setHours: async ({ workerId, projectId, year, month, hours }) => {
    if (!supabase) return;
    const prev = get().entries;
    // 楽観的更新
    const idx = prev.findIndex(
      (e) =>
        e.workerId === workerId &&
        e.projectId === projectId &&
        e.year === year &&
        e.month === month
    );
    const optimistic = [...prev];
    if (hours <= 0) {
      if (idx >= 0) optimistic.splice(idx, 1);
    } else if (idx >= 0) {
      optimistic[idx] = { ...optimistic[idx], hours };
    } else {
      optimistic.push({
        id: `tmp_${workerId}_${projectId}_${year}_${month}`,
        workerId,
        projectId,
        year,
        month,
        hours,
      });
    }
    set({ entries: optimistic });

    try {
      if (hours <= 0) {
        const { error } = await supabase
          .from("entries")
          .delete()
          .match({ worker_id: workerId, project_id: projectId, year, month });
        if (error) throw error;
        return;
      }
      const { data, error } = await supabase
        .from("entries")
        .upsert(
          { worker_id: workerId, project_id: projectId, year, month, hours },
          { onConflict: "worker_id,project_id,year,month" }
        )
        .select()
        .single();
      if (error) throw error;
      // 一時IDを実IDに置き換え
      const saved = toEntry(data as DbEntry);
      set((s) => ({
        entries: s.entries.map((e) =>
          e.workerId === workerId &&
          e.projectId === projectId &&
          e.year === year &&
          e.month === month
            ? saved
            : e
        ),
      }));
    } catch (e) {
      set({ entries: prev });
      fail(set, e);
    }
  },
}));
