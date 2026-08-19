"use client";

import { create } from "zustand";
import { supabase, isSupabaseConfigured } from "../supabase";
import type {
  DbWorker,
  DbPj,
  DbPjMember,
  DbTracker,
  DbIssue,
  DbTask,
  DbTaskEntry,
} from "../supabase";
import {
  toWorker,
  toPj,
  toPjMember,
  toTracker,
  toIssue,
  toTask,
  toTaskEntry,
} from "./mappers";
import { fail } from "./crud";
import { createCoreSlice, type CoreSlice } from "./core";
import { createActualsSlice, type ActualsSlice } from "./actuals";
import type { Shared } from "./types";

export type { Status, Shared } from "./types";

export type Store = Shared & CoreSlice & ActualsSlice;

export const useStore = create<Store>()((set, get, api) => ({
  ...createCoreSlice(set, get, api),
  ...createActualsSlice(set, get, api),

  year: new Date().getFullYear(),
  status: "idle",
  error: null,
  loaded: false,

  setYear: (year) => set({ year }),

  load: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ status: "unconfigured", loaded: true });
      return;
    }
    set({ status: "loading" });
    try {
      const [
        workerRes,
        pjRes,
        memberRes,
        trackerRes,
        issueRes,
        taskRes,
        entryRes,
      ] = await Promise.all([
        supabase.from("workers").select("*").order("created_at"),
        supabase.from("pj").select("*").order("created_at"),
        supabase.from("pj_members").select("*"),
        supabase.from("tracker").select("*"),
        supabase.from("issues").select("*").order("created_at"),
        supabase.from("tasks").select("*").order("start_at"),
        supabase.from("task_entries").select("*"),
      ]);
      for (const r of [
        workerRes,
        pjRes,
        memberRes,
        trackerRes,
        issueRes,
        taskRes,
        entryRes,
      ]) {
        if (r.error) throw r.error;
      }
      set({
        workers: (workerRes.data as DbWorker[]).map(toWorker),
        pjs: (pjRes.data as DbPj[]).map(toPj),
        pjMembers: (memberRes.data as DbPjMember[]).map(toPjMember),
        trackers: (trackerRes.data as DbTracker[]).map(toTracker),
        issues: (issueRes.data as DbIssue[]).map(toIssue),
        tasks: (taskRes.data as DbTask[]).map(toTask),
        taskEntries: (entryRes.data as DbTaskEntry[]).map(toTaskEntry),
        status: "ready",
        error: null,
        loaded: true,
      });
    } catch (e) {
      fail(set, e);
    }
  },
}));
