"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readEnv } from "./env";

const envResult = readEnv();

/** 環境変数の形式が不正な場合のメッセージ（UI で提示）。未設定は含まない。 */
export const envIssues: string[] = envResult.ok ? [] : envResult.issues;

const url = envResult.ok ? envResult.env.NEXT_PUBLIC_SUPABASE_URL : undefined;
const anonKey = envResult.ok
  ? envResult.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : undefined;

/** 環境変数が未設定なら null。UI 側で設定要求バナーを出す。 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = envResult.ok && envResult.configured;

/** DB (snake_case) と アプリ型 (camelCase) の対応 */
/** numeric 列は supabase-js から string で返ることがあるため number | string で受ける。 */

export type DbWorker = {
  id: string;
  name: string;
};

export type DbPj = {
  id: string;
  parent_id: string | null;
  name: string;
  color: string;
  owner_worker_id: string | null;
  fiscal_year: number | null;
  budget_amount: number | string | null;
};

export type DbPjMember = {
  pj_id: string;
  worker_id: string;
};

export type DbTracker = {
  pj_id: string;
  start_date: string | null;
  end_date: string | null;
};

export type DbIssue = {
  id: string;
  tracker_pj_id: string;
  parent_id: string | null;
  assignee_id: string | null;
  title: string;
  due_date: string | null;
  status: string;
};

export type DbTask = {
  id: string;
  tracker_pj_id: string;
  issue_id: string | null;
  assignee_id: string;
  title: string;
  start_at: string;
  end_at: string;
};

export type DbTaskEntry = {
  id: string;
  task_id: string;
  year: number;
  month: number;
  hours: number | string;
};
