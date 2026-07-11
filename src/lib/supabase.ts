"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 環境変数が未設定なら null。UI 側で設定要求バナーを出す。 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(url && anonKey);

/** DB (snake_case) と アプリ型 (camelCase) の対応 */

export type DbTeam = {
  id: string;
  name: string;
};

export type DbWorker = {
  id: string;
  name: string;
  monthly_capacity_hours: number;
};

export type DbClient = {
  id: string;
  name: string;
};

export type DbOrder = {
  id: string;
  client_id: string | null;
  name: string;
  fiscal_year: number | null;
  owner_worker_id: string | null;
  planned_hours: number | string;
  budget_amount: number | string | null;
};

export type DbProject = {
  id: string;
  order_id: string;
  team_id: string | null;
  name: string;
  color: string;
};

export type DbMilestone = {
  id: string;
  project_id: string;
  name: string | null;
  start_date: string;
  end_date: string;
};

export type DbAssignment = {
  id: string;
  worker_id: string;
  project_id: string;
};

export type DbAchievement = {
  id: string;
  assignment_id: string;
  milestone_id: string;
  allowed_hours: number | string;
};

export type DbEntry = {
  id: string;
  worker_id: string;
  project_id: string;
  year: number;
  month: number;
  hours: number | string;
};
