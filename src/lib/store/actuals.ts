"use client";

import type { StateCreator } from "zustand";
import { supabase } from "../supabase";
import type { DbTaskEntry } from "../supabase";
import type { TaskEntry } from "../types";
import { taskEntryInputSchema } from "../schemas";
import { toTaskEntry } from "./mappers";
import { fail, check } from "./crud";
import type { Shared } from "./types";
import type { CoreSlice } from "./core";

export type ActualsState = { taskEntries: TaskEntry[] };

export type ActualsActions = {
  setTaskHours: (args: {
    taskId: string;
    year: number;
    month: number;
    hours: number;
  }) => Promise<void>;
};

export type ActualsSlice = ActualsState & ActualsActions;

export const createActualsSlice: StateCreator<
  ActualsSlice & CoreSlice & Shared,
  [],
  [],
  ActualsSlice
> = (set, get) => ({
  taskEntries: [],

  setTaskHours: async ({ taskId, year, month, hours }) => {
    if (!supabase) return;
    if (!check(taskEntryInputSchema, { taskId, year, month, hours })) return;

    const prev = get().taskEntries;
    const idx = prev.findIndex(
      (e) => e.taskId === taskId && e.year === year && e.month === month
    );
    const optimistic = [...prev];
    if (hours <= 0) {
      if (idx >= 0) optimistic.splice(idx, 1);
    } else if (idx >= 0) {
      optimistic[idx] = { ...optimistic[idx], hours };
    } else {
      optimistic.push({
        id: `tmp_${taskId}_${year}_${month}`,
        taskId,
        year,
        month,
        hours,
      });
    }
    set({ taskEntries: optimistic });

    try {
      if (hours <= 0) {
        const { error } = await supabase
          .from("task_entries")
          .delete()
          .match({ task_id: taskId, year, month });
        if (error) throw error;
        return;
      }
      const { data, error } = await supabase
        .from("task_entries")
        .upsert(
          { task_id: taskId, year, month, hours },
          { onConflict: "task_id,year,month" }
        )
        .select()
        .single();
      if (error) throw error;
      const saved = toTaskEntry(data as DbTaskEntry);
      set({
        taskEntries: get().taskEntries.map((e) =>
          e.taskId === taskId && e.year === year && e.month === month
            ? saved
            : e
        ),
      });
    } catch (e) {
      set({ taskEntries: prev });
      fail(set, e);
    }
  },
});
