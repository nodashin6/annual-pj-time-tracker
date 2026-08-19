# pj 再帰データモデル 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `clients / orders / projects` の3層固定スキーマを `pj` 再帰ツリー1本 + 作業アイテム層に置き換え、工数管理を task 依存の拡張層へ降格させる。

**Architecture:** コア層（`pj` / `pj_members` / `tracker` / `issues` / `tasks`）は工数を一切知らず、実績拡張層（`task_entries`）が一方向にコアを参照する。葉pjの判定は `tracker` 行の存在で行い、宣言フラグを使わない。予定工数は task の期間（timestamptz）から導出し、手入力しない。

**Tech Stack:** Next.js 15 App Router / React 19 / TypeScript 5.7 strict / Zustand 5 / Zod 3.24 / Recharts 2.15 / Supabase (PostgreSQL) / Vitest 2.1

**Spec:** [`docs/superpowers/specs/2026-08-19-pj-recursive-data-model-design.md`](../specs/2026-08-19-pj-recursive-data-model-design.md)

## Global Constraints

- **Zod は 3.24.1。** `z.string({ invalid_type_error })` 系の Zod 3 API を使う。Zod 4 の `z.iso.date()` などは存在しない。
- **`.refine()` を付けたスキーマに `.partial()` は使えない。** update 用の patch スキーマが必要なものは、`z.object({...})` のベースを変数に取り、`export const xInputSchema = base.refine(...)` と `export const xPatchSchema = base.partial()` の2本を出す。
- **TypeScript strict。`any` はESLintで禁止**（`no-explicit-any`）。
- **DB は snake_case、アプリは camelCase。** 変換は `src/lib/store/mappers.ts` に集約し、他の場所で snake_case を書かない。
- **コミット前に Prettier。** `npm run format` を通してから `git add`。
- **既存データの移行はしない。** `schema.sql` は drop & recreate。
- **依存の向き**: `src/lib/aggregate/tree.ts` と `src/lib/aggregate/plan.ts` は `TaskEntry` および `progress.ts` を import してはならない。Task 6 のテストがこれを固定する。

## ビルドが赤くなる区間について（重要）

これは大規模な置き換えなので、**Task 2 から Task 12 の途中まで `npm run typecheck` と `npm run build` は失敗する**。旧 `store.ts` / 旧画面が削除済みの型を参照するためで、想定どおりの状態。この区間の検証は各タスクに書かれた `npx vitest run <file>` のみで行い、typecheck を通すために余計な修正を入れないこと。全体の green 回復は Task 13 で行う。

---

### Task 1: SQL スキーマの全面書き直し

**Files:**

- Modify: `supabase/schema.sql`（全面書き直し）
- Modify: `supabase/policies-authenticated.sql`（全面書き直し）

**Interfaces:**

- Consumes: なし
- Produces: テーブル `workers` `pj` `pj_members` `tracker` `issues` `tasks` `task_entries`。列名は spec §4 のとおり。

- [ ] **Step 1: `supabase/schema.sql` を書き直す**

ファイル全体を以下で置き換える。

```sql
-- 年間稼働トラッカー — Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください。
--
-- ⚠️ 破壊的スクリプトです。このスクリプトを再実行すると、旧モデル・新モデルを問わず
--   既存のテーブル（workers を含む）とそのデータは全て破棄され、空の状態から再作成されます。
--   既存データの移行は行いません。
--
-- データモデル:
--   コア層:   pj (再帰ツリー) ─ tracker (葉の印) ─ issues / tasks
--   実績拡張層: task_entries (task × 年月 × 時間)
--
--   pj は自己参照の再帰ツリー。tracker 行が存在する pj が「葉」であり、
--   葉にだけ issues（GitHub issue 相当）と tasks（カレンダーイベント相当）が刺さる。
--   工数はコア層に存在しない。予定工数は task の期間から導出し、
--   実績のみを task_entries に持つ。

-- ========== 旧モデルの撤去 ==========
-- workers も含めて全て drop & recreate する（サンプルデータ投入ガードが
-- workers の件数を見るため、workers を残したままだと旧データが残っている環境で
-- ガードが誤って「投入済み」と判定し、シードがサイレントに skip されてしまう）。
drop table if exists public.achievements cascade;
drop table if exists public.assignments cascade;
drop table if exists public.milestones cascade;
drop table if exists public.entries cascade;
drop table if exists public.projects cascade;
drop table if exists public.orders cascade;
drop table if exists public.clients cascade;
drop table if exists public.teams cascade;
drop table if exists public.workers cascade;

-- ========== コア層 ==========

-- ワーカー（作業者）。pj_members で pj へアサインする。
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- pj: 顧客・受注・プロジェクトを統合した再帰ツリー。
-- fiscal_year / budget_amount が入っているノードを「契約単位（受注）」とみなす。
-- 工数の列は持たない（工数は task 依存の拡張層の責務）。
create table if not exists public.pj (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.pj(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  owner_worker_id uuid references public.workers(id) on delete set null,
  fiscal_year integer,
  budget_amount numeric(14, 2),
  created_at timestamptz not null default now()
);

create index if not exists pj_parent_idx on public.pj (parent_id);
create index if not exists pj_fiscal_year_idx on public.pj (fiscal_year);

create table if not exists public.pj_members (
  pj_id uuid not null references public.pj(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pj_id, worker_id)
);

create index if not exists pj_members_worker_idx on public.pj_members (worker_id);

-- tracker: 「この pj は葉である」という事実そのもの。旧 milestones の吸収先。
-- 行の存在が葉の定義なので、kind のような宣言フラグは置かない。
create table if not exists public.tracker (
  pj_id uuid primary key references public.pj(id) on delete cascade,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  check (start_date is null or end_date is null or start_date <= end_date)
);

-- issues: GitHub issue 相当。階層あり・期日あり・担当者は宙ぶらりん可。
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  tracker_pj_id uuid not null references public.tracker(pj_id) on delete cascade,
  parent_id uuid references public.issues(id) on delete cascade,
  assignee_id uuid references public.workers(id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists issues_tracker_idx on public.issues (tracker_pj_id);
create index if not exists issues_parent_idx on public.issues (parent_id);

-- tasks: Google Calendar のイベント相当。階層なし・時刻付き期間・担当者1名必須。
-- 予定工数は end_at - start_at から導出するため、工数の列を持たない。
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  tracker_pj_id uuid not null references public.tracker(pj_id) on delete cascade,
  issue_id uuid references public.issues(id) on delete set null,
  assignee_id uuid not null references public.workers(id) on delete restrict,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (start_at < end_at)
);

create index if not exists tasks_tracker_idx on public.tasks (tracker_pj_id);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_issue_idx on public.tasks (issue_id);

-- ========== 実績拡張層 ==========
-- コア層を一方向に参照する。この層を丸ごと落としてもコア層は動作する。

create table if not exists public.task_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  hours numeric(6, 1) not null default 0,
  created_at timestamptz not null default now(),
  unique (task_id, year, month)
);

create index if not exists task_entries_year_idx on public.task_entries (year);
create index if not exists task_entries_task_idx on public.task_entries (task_id);

-- ========== トリガ ==========

-- 1. 循環防止: parent_id を辿って自分に戻ってきたら reject。
create or replace function public.pj_no_cycle() returns trigger as $$
declare
  cur uuid := new.parent_id;
  hops integer := 0;
begin
  while cur is not null loop
    if cur = new.id then
      raise exception 'pj の親子関係が循環しています (id=%)', new.id;
    end if;
    hops := hops + 1;
    if hops > 10000 then
      raise exception 'pj の親子関係が深すぎます (id=%)', new.id;
    end if;
    select parent_id into cur from public.pj where id = cur;
  end loop;
  return new;
end $$ language plpgsql;

drop trigger if exists pj_no_cycle_trg on public.pj;
create trigger pj_no_cycle_trg
  before insert or update of parent_id on public.pj
  for each row execute function public.pj_no_cycle();

-- 2. 葉の整合（双方向）: tracker を持つ pj は子を持てない。
create or replace function public.tracker_pj_has_no_child() returns trigger as $$
begin
  if exists (select 1 from public.pj where parent_id = new.pj_id) then
    raise exception '子を持つ pj には tracker を付けられません (pj_id=%)', new.pj_id;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists tracker_pj_has_no_child_trg on public.tracker;
create trigger tracker_pj_has_no_child_trg
  before insert or update on public.tracker
  for each row execute function public.tracker_pj_has_no_child();

create or replace function public.pj_parent_has_no_tracker() returns trigger as $$
begin
  if new.parent_id is not null
     and exists (select 1 from public.tracker where pj_id = new.parent_id) then
    raise exception 'tracker を持つ pj の下に子は作れません (parent_id=%)', new.parent_id;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists pj_parent_has_no_tracker_trg on public.pj;
create trigger pj_parent_has_no_tracker_trg
  before insert or update of parent_id on public.pj
  for each row execute function public.pj_parent_has_no_tracker();

-- 3. issue の親子は同一 tracker 内に限定する。
create or replace function public.issue_same_tracker() returns trigger as $$
declare
  parent_tracker uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  select tracker_pj_id into parent_tracker from public.issues where id = new.parent_id;
  if parent_tracker is distinct from new.tracker_pj_id then
    raise exception 'issue の親子は同一の tracker 内に限られます (id=%)', new.id;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists issue_same_tracker_trg on public.issues;
create trigger issue_same_tracker_trg
  before insert or update on public.issues
  for each row execute function public.issue_same_tracker();

-- ========== RLS ==========
-- デモ用途のため anon による読み書きを許可します。
-- 本番でユーザー認証を導入する場合は policies-authenticated.sql に置き換えてください。

alter table public.workers enable row level security;
alter table public.pj enable row level security;
alter table public.pj_members enable row level security;
alter table public.tracker enable row level security;
alter table public.issues enable row level security;
alter table public.tasks enable row level security;
alter table public.task_entries enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['workers', 'pj', 'pj_members', 'tracker', 'issues', 'tasks', 'task_entries'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_all') then
      execute format('create policy %I on public.%I for all using (true) with check (true)', t || '_all', t);
    end if;
  end loop;
end $$;

-- ========== サンプルデータ（任意） ==========
-- 空の場合のみ投入します。再帰構造が効いていることを目視できるよう、
-- 「顧客 → 受注 → サブ受注 → PJ(葉)」の4段のツリーを1本含めます。

do $$
declare
  w1 uuid; w2 uuid; w3 uuid; w4 uuid;
  c_in uuid; c_a uuid; c_b uuid;
  o1 uuid; o2 uuid; o3 uuid;
  sub1 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  i1 uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid;
  mth integer;
  yr integer := 2026;
begin
  if (select count(*) from public.workers) > 0 then
    return;
  end if;

  insert into public.workers (name) values ('佐藤 太郎') returning id into w1;
  insert into public.workers (name) values ('鈴木 花子') returning id into w2;
  insert into public.workers (name) values ('高橋 健')   returning id into w3;
  insert into public.workers (name) values ('田中 誠')   returning id into w4;

  -- 深さ0: 顧客
  insert into public.pj (name, color) values ('社内', '#64748b') returning id into c_in;
  insert into public.pj (name, color) values ('A社',  '#64748b') returning id into c_a;
  insert into public.pj (name, color) values ('B社',  '#64748b') returning id into c_b;

  -- 深さ1: 受注（fiscal_year / budget_amount を持つ = 契約ノード）
  insert into public.pj (parent_id, name, color, owner_worker_id, fiscal_year, budget_amount)
    values (c_in, '社内基盤刷新 受注', '#6366f1', w1, yr, 30000000) returning id into o1;
  insert into public.pj (parent_id, name, color, owner_worker_id, fiscal_year, budget_amount)
    values (c_a, 'ECサイト構築 受注', '#10b981', w2, yr, 24000000) returning id into o2;
  insert into public.pj (parent_id, name, color, owner_worker_id, fiscal_year, budget_amount)
    values (c_b, '保守運用 受注', '#f59e0b', w3, yr, 12000000) returning id into o3;

  -- 深さ2: 中間ノード（受注でも葉でもない、再帰が効いていることの実例。o1 をさらに束ねる）
  insert into public.pj (parent_id, name, color) values (o1, 'フェーズ1', '#818cf8')
    returning id into sub1;

  -- 深さ2〜3: 葉
  insert into public.pj (parent_id, name, color) values (sub1, '基盤設計', '#6366f1') returning id into p1;
  insert into public.pj (parent_id, name, color) values (sub1, 'R&D / 提案', '#ef4444') returning id into p4;
  insert into public.pj (parent_id, name, color) values (o2, 'EC フロントエンド', '#10b981') returning id into p2;
  insert into public.pj (parent_id, name, color) values (o3, '定常保守', '#f59e0b') returning id into p3;

  -- メンバー（有効メンバーは祖先からの継承も含むので、上位に置くものもある）
  insert into public.pj_members (pj_id, worker_id) values
    (o1, w1), (sub1, w2), (p1, w1), (p4, w3), (o2, w2), (p2, w2), (o3, w3), (p3, w4);

  -- tracker（葉の印 + 期間）
  insert into public.tracker (pj_id, start_date, end_date) values
    (p1, date '2026-01-01', date '2026-12-31'),
    (p2, date '2026-01-01', date '2026-12-31'),
    (p3, date '2026-01-01', date '2026-12-31'),
    (p4, date '2026-01-01', date '2026-12-31');

  -- issue（担当者が宙ぶらりんのものを1件含める）
  insert into public.issues (tracker_pj_id, assignee_id, title, due_date, status)
    values (p1, w1, '認証基盤の刷新', date '2026-06-30', 'open') returning id into i1;
  insert into public.issues (tracker_pj_id, parent_id, assignee_id, title, due_date, status)
    values (p1, i1, 'IdP 選定', date '2026-03-31', 'closed');
  insert into public.issues (tracker_pj_id, title, due_date, status)
    values (p2, 'カート離脱率の改善', date '2026-09-30', 'open');

  -- task（カレンダーのイベント。1日に収める運用）
  insert into public.tasks (tracker_pj_id, issue_id, assignee_id, title, start_at, end_at)
    values (p1, i1, w1, 'IdP 比較検討', timestamptz '2026-02-10 10:00+09', timestamptz '2026-02-10 18:00+09')
    returning id into t1;
  insert into public.tasks (tracker_pj_id, assignee_id, title, start_at, end_at)
    values (p2, w2, 'カート画面 実装', timestamptz '2026-03-05 09:00+09', timestamptz '2026-03-05 17:00+09')
    returning id into t2;
  insert into public.tasks (tracker_pj_id, assignee_id, title, start_at, end_at)
    values (p3, w4, '月次リリース作業', timestamptz '2026-04-20 13:00+09', timestamptz '2026-04-20 18:00+09')
    returning id into t3;
  insert into public.tasks (tracker_pj_id, assignee_id, title, start_at, end_at)
    values (p4, w3, '提案書ドラフト', timestamptz '2026-05-12 10:00+09', timestamptz '2026-05-12 15:00+09')
    returning id into t4;

  -- 実績（拡張層）
  insert into public.task_entries (task_id, year, month, hours) values
    (t1, yr, 2, 8), (t2, yr, 3, 7.5), (t3, yr, 4, 5), (t4, yr, 5, 4);

  -- 月次の見え方を確認できるよう、保守の task に複数月ぶんの実績を足す
  for mth in 5..12 loop
    insert into public.task_entries (task_id, year, month, hours) values (t3, yr, mth, 6)
      on conflict (task_id, year, month) do nothing;
  end loop;
end $$;
```

- [ ] **Step 2: `supabase/policies-authenticated.sql` を書き直す**

既存ファイルを開いて構造を確認し、テーブル配列だけを新しいものに差し替える。中身の書き方（`for all using (auth.role() = 'authenticated')` 等）は既存の記述をそのまま踏襲すること。配列は以下にする。

```sql
array['workers', 'pj', 'pj_members', 'tracker', 'issues', 'tasks', 'task_entries']
```

旧テーブル名（`teams` `clients` `orders` `projects` `milestones` `assignments` `achievements` `entries`）への参照がファイル内に1つも残っていないことを確認する。

- [ ] **Step 3: Supabase に適用して検証**

Supabase ダッシュボード > SQL Editor に `supabase/schema.sql` 全文を貼って実行する。エラーなく完了したら、同じエディタで以下を実行し、結果が右のとおりになることを確認する。

```sql
select
  (select count(*) from public.pj)           as pj,            -- 11
  (select count(*) from public.tracker)      as tracker,       --  4
  (select count(*) from public.tasks)        as tasks,         --  4
  (select count(*) from public.issues)       as issues,        --  3
  (select count(*) from public.task_entries) as entries;       -- 12
```

続けてトリガが効くことを確認する。3つとも **エラーになれば成功**。

```sql
-- 葉に子を作ろうとする → 失敗するはず
insert into public.pj (parent_id, name)
  select id, 'ng' from public.tracker limit 1;

-- 子持ちノードに tracker を付けようとする → 失敗するはず
insert into public.tracker (pj_id)
  select parent_id from public.pj where parent_id is not null limit 1;

-- 自分を親にする → 失敗するはず
update public.pj set parent_id = id where parent_id is null;
```

- [ ] **Step 4: コミット**

```bash
npm run format
git add supabase/schema.sql supabase/policies-authenticated.sql
git commit -m "feat(db): pj 再帰モデルへスキーマを全面刷新"
```

---

### Task 2: 型定義と Zod スキーマの差し替え

**Files:**

- Modify: `src/lib/types.ts`（全面書き直し）
- Modify: `src/lib/supabase.ts:22-88`（`Db*` 型ブロックのみ差し替え。上部の client 生成は触らない）
- Modify: `src/lib/schemas.ts`（全面書き直し）
- Test: `src/lib/schemas.test.ts`（全面書き直し）

**Interfaces:**

- Consumes: なし
- Produces:

  - `types.ts`: `Worker` `Pj` `PjMember` `Tracker` `Issue` `Task` `TaskEntry` `MONTHS` `MONTH_LABELS`
  - `supabase.ts`: `DbWorker` `DbPj` `DbPjMember` `DbTracker` `DbIssue` `DbTask` `DbTaskEntry`
  - `schemas.ts`: `pjInputSchema` `pjPatchSchema` `trackerInputSchema` `trackerPatchSchema` `issueInputSchema` `issuePatchSchema` `taskInputSchema` `taskPatchSchema` `taskEntryInputSchema` `workerInputSchema` `validate` `ValidationResult`

- [ ] **Step 1: `src/lib/types.ts` を書き直す**

```ts
// ========== コア層 ==========
// この層は工数を一切知らない。実績拡張層を削除しても成立する。

/** ワーカー（作業者）。pj_members で pj へアサインする。 */
export type Worker = {
  id: string;
  name: string;
};

/**
 * pj: 顧客・受注・プロジェクトを統合した再帰ツリーのノード。
 * fiscalYear / budgetAmount が入っているノードを「契約単位（受注）」とみなす。
 * 判定は aggregate/tree.ts の isContractNode() でのみ行う。
 */
export type Pj = {
  id: string;
  parentId?: string;
  name: string;
  /** グラフ表示用のカラー（HEX） */
  color: string;
  ownerWorkerId?: string;
  fiscalYear?: number;
  budgetAmount?: number;
};

export type PjMember = {
  pjId: string;
  workerId: string;
};

/**
 * tracker: 「この pj は葉である」という事実そのもの。旧 milestones の吸収先。
 * 行の存在が葉の定義であり、kind のような宣言フラグは持たない。
 */
export type Tracker = {
  pjId: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
};

/** issue: GitHub issue 相当。階層あり・期日あり・担当者は宙ぶらりん可。 */
export type Issue = {
  id: string;
  trackerPjId: string;
  parentId?: string;
  assigneeId?: string;
  title: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  status: IssueStatus;
};

export const ISSUE_STATUSES = ["open", "closed"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/**
 * task: Google Calendar のイベント相当。階層なし・時刻付き期間・担当者1名必須。
 * 予定工数は期間から導出するため、工数の項目を持たない。
 */
export type Task = {
  id: string;
  trackerPjId: string;
  issueId?: string;
  assigneeId: string;
  title: string;
  /** ISO8601 */
  startAt: string;
  /** ISO8601 */
  endAt: string;
};

// ========== 実績拡張層 ==========
// コア層を一方向に参照する。担当者は task.assigneeId から引くため持たない。

export type TaskEntry = {
  id: string;
  taskId: string;
  year: number;
  /** 1-12 */
  month: number;
  hours: number;
};

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
] as const;
```

- [ ] **Step 2: `src/lib/supabase.ts` の `Db*` 型を差し替える**

22行目のコメント `/** DB (snake_case) と アプリ型 (camelCase) の対応 */` 以降を全て以下で置き換える。1〜21行目（client 生成部分）は変更しない。

```ts
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
```

- [ ] **Step 3: `src/lib/schemas.test.ts` を書き直す（失敗するテスト）**

```ts
import { describe, it, expect } from "vitest";
import {
  validate,
  pjInputSchema,
  pjPatchSchema,
  trackerInputSchema,
  issueInputSchema,
  taskInputSchema,
  taskPatchSchema,
  taskEntryInputSchema,
  workerInputSchema,
} from "./schemas";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("workerInputSchema", () => {
  it("前後の空白を除去する", () => {
    const r = validate(workerInputSchema, { name: "  佐藤  " });
    expect(r.ok && r.data.name).toBe("佐藤");
  });

  it("空文字を弾く", () => {
    const r = validate(workerInputSchema, { name: "   " });
    expect(r.ok).toBe(false);
  });
});

describe("pjInputSchema", () => {
  it("名前だけで通る（親なしルートノード）", () => {
    const r = validate(pjInputSchema, { name: "A社" });
    expect(r.ok).toBe(true);
  });

  it("parentId は uuid でなければ弾く", () => {
    const r = validate(pjInputSchema, { name: "受注", parentId: "abc" });
    expect(r.ok).toBe(false);
  });

  it("color は #RRGGBB でなければ弾く", () => {
    const r = validate(pjInputSchema, { name: "受注", color: "red" });
    expect(r.ok).toBe(false);
  });

  it("budgetAmount は負数を弾く", () => {
    const r = validate(pjInputSchema, { name: "受注", budgetAmount: -1 });
    expect(r.ok).toBe(false);
  });

  it("patch は部分適用できる", () => {
    const r = validate(pjPatchSchema, { name: "改名だけ" });
    expect(r.ok).toBe(true);
  });
});

describe("trackerInputSchema", () => {
  it("開始 <= 終了 なら通る", () => {
    const r = validate(trackerInputSchema, {
      pjId: UUID,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(r.ok).toBe(true);
  });

  it("開始 > 終了 を弾く", () => {
    const r = validate(trackerInputSchema, {
      pjId: UUID,
      startDate: "2026-12-31",
      endDate: "2026-01-01",
    });
    expect(r.ok).toBe(false);
  });

  it("日付なしでも通る（期間未定の葉）", () => {
    const r = validate(trackerInputSchema, { pjId: UUID });
    expect(r.ok).toBe(true);
  });
});

describe("issueInputSchema", () => {
  it("担当者なしで通る（宙ぶらりん可）", () => {
    const r = validate(issueInputSchema, {
      trackerPjId: UUID,
      title: "カート離脱率の改善",
    });
    expect(r.ok && r.data.status).toBe("open");
  });

  it("未知の status を弾く", () => {
    const r = validate(issueInputSchema, {
      trackerPjId: UUID,
      title: "x",
      status: "wontfix",
    });
    expect(r.ok).toBe(false);
  });
});

describe("taskInputSchema", () => {
  const base = {
    trackerPjId: UUID,
    assigneeId: UUID2,
    title: "IdP 比較検討",
    startAt: "2026-02-10T10:00:00+09:00",
    endAt: "2026-02-10T18:00:00+09:00",
  };

  it("担当者と期間が揃えば通る", () => {
    expect(validate(taskInputSchema, base).ok).toBe(true);
  });

  it("担当者なしを弾く（必須1名）", () => {
    expect(
      validate(taskInputSchema, { ...base, assigneeId: undefined }).ok
    ).toBe(false);
  });

  it("開始 >= 終了 を弾く", () => {
    const r = validate(taskInputSchema, { ...base, endAt: base.startAt });
    expect(r.ok).toBe(false);
  });

  it("パースできない日時を弾く", () => {
    const r = validate(taskInputSchema, { ...base, startAt: "きのう" });
    expect(r.ok).toBe(false);
  });

  it("patch は部分適用できる", () => {
    expect(validate(taskPatchSchema, { title: "改題" }).ok).toBe(true);
  });
});

describe("taskEntryInputSchema", () => {
  it("1-12 月のみ通す", () => {
    const ok = validate(taskEntryInputSchema, {
      taskId: UUID,
      year: 2026,
      month: 12,
      hours: 8,
    });
    expect(ok.ok).toBe(true);

    const ng = validate(taskEntryInputSchema, {
      taskId: UUID,
      year: 2026,
      month: 13,
      hours: 8,
    });
    expect(ng.ok).toBe(false);
  });

  it("負の工数を弾く", () => {
    const r = validate(taskEntryInputSchema, {
      taskId: UUID,
      year: 2026,
      month: 1,
      hours: -1,
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 4: テストが失敗することを確認**

```bash
npx vitest run src/lib/schemas.test.ts
```

Expected: FAIL（`pjInputSchema` などが export されていない）

- [ ] **Step 5: `src/lib/schemas.ts` を書き直す**

`validate()` と `ValidationResult` は現行のまま残し、スキーマ定義部を差し替える。

```ts
/**
 * ドメイン入力のバリデーションスキーマ（Zod）。
 *
 * フォーム/ストアの書き込み前にここで検証し、不正なデータが Supabase に
 * 到達するのを防ぐ。UI 表示型（types.ts）とは別に「入力（create/update）」の
 * 制約を集約する単一の真実の源。
 *
 * refine 付きのスキーマには .partial() が使えないため、
 * update 用には base.partial() から作った *PatchSchema を別に出す。
 */
import { z } from "zod";
import { ISSUE_STATUSES } from "./types";

const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 名称: 前後空白を除去して 1〜120 文字。 */
const name = z
  .string()
  .trim()
  .min(1, "名称を入力してください")
  .max(120, "名称は120文字以内で入力してください");

/** 工数（時間）: 0 以上。 */
const hours = z
  .number({ invalid_type_error: "数値を入力してください" })
  .finite("有効な数値を入力してください")
  .min(0, "工数は0以上で入力してください")
  .max(100000, "工数が大きすぎます");

/** 金額: 0 以上。 */
const amount = z
  .number({ invalid_type_error: "数値を入力してください" })
  .finite()
  .min(0, "金額は0以上で入力してください");

/** 会計年度 / 実績の年。 */
const year = z
  .number()
  .int("年度は整数で入力してください")
  .min(1970, "年度が範囲外です")
  .max(2999, "年度が範囲外です");

const isoDate = z
  .string()
  .regex(ISO_DATE, "日付は YYYY-MM-DD 形式で指定してください");

/** ISO8601 の日時。Date.parse できることまで見る。 */
const isoDateTime = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "日時の形式が不正です");

const color = z
  .string()
  .regex(HEX_COLOR, "カラーは #RRGGBB 形式で指定してください")
  .optional()
  .or(z.literal(""));

// ---- マスタ ----
export const workerInputSchema = z.object({ name });

// ---- pj（再帰ツリー） ----
const pjInputBase = z.object({
  name,
  parentId: z.string().uuid().optional(),
  color,
  ownerWorkerId: z.string().uuid().optional(),
  fiscalYear: year.optional(),
  budgetAmount: amount.optional(),
});
export const pjInputSchema = pjInputBase;
export const pjPatchSchema = pjInputBase.partial();

// ---- tracker（葉の印 + 期間） ----
const trackerInputBase = z.object({
  pjId: z.string().uuid(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});
export const trackerInputSchema = trackerInputBase.refine(
  (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
  { message: "終了日は開始日以降にしてください", path: ["endDate"] }
);
export const trackerPatchSchema = trackerInputBase.partial();

// ---- issue（GitHub issue 相当） ----
const issueInputBase = z.object({
  trackerPjId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  title: name,
  dueDate: isoDate.optional(),
  status: z.enum(ISSUE_STATUSES).default("open"),
});
export const issueInputSchema = issueInputBase;
export const issuePatchSchema = issueInputBase.partial();

// ---- task（カレンダーイベント相当） ----
const taskInputBase = z.object({
  trackerPjId: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  assigneeId: z.string().uuid("担当者を選択してください"),
  title: name,
  startAt: isoDateTime,
  endAt: isoDateTime,
});
export const taskInputSchema = taskInputBase.refine(
  (v) => Date.parse(v.startAt) < Date.parse(v.endAt),
  { message: "終了日時は開始日時より後にしてください", path: ["endAt"] }
);
export const taskPatchSchema = taskInputBase.partial();

// ---- 実績（拡張層） ----
export const taskEntryInputSchema = z.object({
  taskId: z.string().uuid(),
  year,
  month: z
    .number()
    .int()
    .min(1, "月は1〜12で指定してください")
    .max(12, "月は1〜12で指定してください"),
  hours,
});

// 入力型は z.input を使う。z.infer（= z.output）だと status の .default("open") が
// 適用済みの型になり、status を省略した呼び出しが型エラーになるため。
export type WorkerInput = z.input<typeof workerInputSchema>;
export type PjInput = z.input<typeof pjInputSchema>;
export type TrackerInput = z.input<typeof trackerInputSchema>;
export type IssueInput = z.input<typeof issueInputSchema>;
export type TaskInput = z.input<typeof taskInputSchema>;
export type TaskEntryInput = z.input<typeof taskEntryInputSchema>;
```

このあと、現行ファイル末尾にある `ValidationResult` 型と `validate()` 関数（85〜106行目）はそのまま残すこと。削除しないこと。

- [ ] **Step 6: テストが通ることを確認**

```bash
npx vitest run src/lib/schemas.test.ts
```

Expected: PASS（全ケース）

- [ ] **Step 7: コミット**

```bash
npm run format
git add src/lib/types.ts src/lib/supabase.ts src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat(model): 型と Zod スキーマを pj 再帰モデルへ差し替え"
```

---

### Task 3: `aggregate/tree.ts` — ツリー操作とコア層の述語

**Files:**

- Create: `src/lib/aggregate/tree.ts`
- Test: `src/lib/aggregate/tree.test.ts`

**Interfaces:**

- Consumes: `types.ts` の `Pj` `PjMember` `Tracker`
- Produces:
  - `isContractNode(pj: Pj): boolean`
  - `isLeaf(pjId: string, trackers: Tracker[]): boolean`
  - `leafPjs(pjs: Pj[], trackers: Tracker[]): Pj[]`
  - `childrenOf(parentId: string | undefined, pjs: Pj[]): Pj[]`
  - `descendantIds(pjId: string, pjs: Pj[]): string[]` — 自分自身を含む
  - `ancestorIds(pjId: string, pjs: Pj[]): string[]` — 自分を含まない。近い順
  - `breadcrumb(pjId: string, pjs: Pj[]): Pj[]` — ルートから自分まで
  - `effectiveMembers(pjId: string, pjs: Pj[], members: PjMember[]): string[]`
  - `contractNodes(pjs: Pj[]): Pj[]`

**このファイルは `TaskEntry` と `progress.ts` を import してはならない。**

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect } from "vitest";
import type { Pj, PjMember, Tracker } from "../types";
import {
  isContractNode,
  isLeaf,
  leafPjs,
  childrenOf,
  descendantIds,
  ancestorIds,
  breadcrumb,
  effectiveMembers,
  contractNodes,
} from "./tree";

const pj = (id: string, parentId?: string, extra: Partial<Pj> = {}): Pj => ({
  id,
  parentId,
  name: id,
  color: "#6366f1",
  ...extra,
});

//  客 ─ 受注 ─ サブ ─ 葉1
//              └───── 葉2
//  孤立（親IDが存在しないノード）
const PJS: Pj[] = [
  pj("客"),
  pj("受注", "客", { fiscalYear: 2026, budgetAmount: 1000 }),
  pj("サブ", "受注"),
  pj("葉1", "サブ"),
  pj("葉2", "サブ"),
  pj("孤立", "存在しない親"),
];

const TRACKERS: Tracker[] = [{ pjId: "葉1" }, { pjId: "葉2" }];

describe("isContractNode", () => {
  it("fiscalYear だけでも契約ノード", () => {
    expect(isContractNode(pj("x", undefined, { fiscalYear: 2026 }))).toBe(true);
  });

  it("budgetAmount だけでも契約ノード", () => {
    expect(isContractNode(pj("x", undefined, { budgetAmount: 1 }))).toBe(true);
  });

  it("budgetAmount が 0 でも契約ノード（未入力と区別する）", () => {
    expect(isContractNode(pj("x", undefined, { budgetAmount: 0 }))).toBe(true);
  });

  it("どちらも無ければ契約ノードではない", () => {
    expect(isContractNode(pj("x"))).toBe(false);
  });
});

describe("isLeaf / leafPjs", () => {
  it("tracker がある pj が葉", () => {
    expect(isLeaf("葉1", TRACKERS)).toBe(true);
    expect(isLeaf("サブ", TRACKERS)).toBe(false);
  });

  it("葉の一覧を返す", () => {
    expect(leafPjs(PJS, TRACKERS).map((p) => p.id)).toEqual(["葉1", "葉2"]);
  });

  it("tracker が空なら葉はゼロ", () => {
    expect(leafPjs(PJS, [])).toEqual([]);
  });
});

describe("childrenOf", () => {
  it("直下の子だけを返す", () => {
    expect(childrenOf("サブ", PJS).map((p) => p.id)).toEqual(["葉1", "葉2"]);
  });

  it("undefined でルートノードを返す", () => {
    expect(childrenOf(undefined, PJS).map((p) => p.id)).toEqual(["客"]);
  });
});

describe("descendantIds", () => {
  it("自分自身を含む（深さ3以上を辿る）", () => {
    expect(descendantIds("客", PJS).sort()).toEqual(
      ["サブ", "受注", "客", "葉1", "葉2"].sort()
    );
  });

  it("葉なら自分だけ", () => {
    expect(descendantIds("葉1", PJS)).toEqual(["葉1"]);
  });
});

describe("ancestorIds", () => {
  it("近い順に祖先を返す。自分は含まない", () => {
    expect(ancestorIds("葉1", PJS)).toEqual(["サブ", "受注", "客"]);
  });

  it("ルートなら空", () => {
    expect(ancestorIds("客", PJS)).toEqual([]);
  });

  it("親IDが存在しないノードでも無限ループしない", () => {
    expect(ancestorIds("孤立", PJS)).toEqual([]);
  });

  it("循環していても無限ループせず打ち切る", () => {
    const cyclic: Pj[] = [pj("a", "b"), pj("b", "a")];
    expect(ancestorIds("a", cyclic).length).toBeLessThanOrEqual(2);
  });
});

describe("breadcrumb", () => {
  it("ルートから自分までを順に返す", () => {
    expect(breadcrumb("葉1", PJS).map((p) => p.id)).toEqual([
      "客",
      "受注",
      "サブ",
      "葉1",
    ]);
  });
});

describe("effectiveMembers", () => {
  const MEMBERS: PjMember[] = [
    { pjId: "受注", workerId: "w1" },
    { pjId: "サブ", workerId: "w2" },
    { pjId: "葉1", workerId: "w1" },
    { pjId: "葉1", workerId: "w3" },
  ];

  it("自ノード + 全祖先の和集合を返す", () => {
    expect(effectiveMembers("葉1", PJS, MEMBERS).sort()).toEqual([
      "w1",
      "w2",
      "w3",
    ]);
  });

  it("重複を排除する", () => {
    const ids = effectiveMembers("葉1", PJS, MEMBERS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("祖先にしかいないメンバーも継承する", () => {
    expect(effectiveMembers("葉2", PJS, MEMBERS).sort()).toEqual(["w1", "w2"]);
  });
});

describe("contractNodes", () => {
  it("契約ノードだけを抜き出す", () => {
    expect(contractNodes(PJS).map((p) => p.id)).toEqual(["受注"]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/lib/aggregate/tree.test.ts
```

Expected: FAIL（`./tree` が存在しない）

- [ ] **Step 3: `src/lib/aggregate/tree.ts` を実装する**

```ts
/**
 * pj ツリーに対する純関数。コア層のみを扱う。
 *
 * このファイルは実績拡張層（TaskEntry / progress.ts）を import しない。
 * 依存の向きは aggregate/layering.test.ts が固定している。
 */
import type { Pj, PjMember, Tracker } from "../types";

/** 循環していた場合の打ち切り上限。 */
const MAX_DEPTH = 1000;

/**
 * 契約（受注）ノードか。
 * fiscalYear / budgetAmount の有無で判定する規則が存在してよいのはここだけ。
 * UI から `pj.fiscalYear != null` を直接書かないこと。
 */
export const isContractNode = (pj: Pj): boolean =>
  pj.fiscalYear != null || pj.budgetAmount != null;

export const contractNodes = (pjs: Pj[]): Pj[] => pjs.filter(isContractNode);

/** 葉か。tracker 行の存在がすべて。 */
export const isLeaf = (pjId: string, trackers: Tracker[]): boolean =>
  trackers.some((t) => t.pjId === pjId);

export const leafPjs = (pjs: Pj[], trackers: Tracker[]): Pj[] =>
  pjs.filter((p) => isLeaf(p.id, trackers));

/** 直下の子。parentId に undefined を渡すとルートノードを返す。 */
export const childrenOf = (parentId: string | undefined, pjs: Pj[]): Pj[] =>
  pjs.filter((p) => p.parentId === parentId);

/** 自分自身を含む子孫の id。 */
export function descendantIds(pjId: string, pjs: Pj[]): string[] {
  const out: string[] = [];
  const queue = [pjId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of pjs) {
      if (child.parentId === id) queue.push(child.id);
    }
  }
  return out;
}

/** 祖先の id を近い順に。自分は含まない。循環・親欠落でも停止する。 */
export function ancestorIds(pjId: string, pjs: Pj[]): string[] {
  const byId = new Map(pjs.map((p) => [p.id, p]));
  const out: string[] = [];
  const seen = new Set<string>([pjId]);
  let cur = byId.get(pjId)?.parentId;
  let hops = 0;
  while (cur != null && !seen.has(cur) && hops < MAX_DEPTH) {
    const node = byId.get(cur);
    if (!node) break;
    out.push(node.id);
    seen.add(node.id);
    cur = node.parentId;
    hops += 1;
  }
  return out;
}

/** ルートから自分までのパス。パンくず表示用。 */
export function breadcrumb(pjId: string, pjs: Pj[]): Pj[] {
  const byId = new Map(pjs.map((p) => [p.id, p]));
  const self = byId.get(pjId);
  if (!self) return [];
  const chain = ancestorIds(pjId, pjs)
    .map((id) => byId.get(id))
    .filter((p): p is Pj => p != null)
    .reverse();
  return [...chain, self];
}

/**
 * 有効メンバー = 自ノード + 全祖先の和集合。
 * task の担当者候補はこれで絞る。DB トリガにはしない（メンバーを外した瞬間に
 * 既存 task が更新不能になるため）。
 */
export function effectiveMembers(
  pjId: string,
  pjs: Pj[],
  members: PjMember[]
): string[] {
  const scope = new Set([pjId, ...ancestorIds(pjId, pjs)]);
  const out = new Set<string>();
  for (const m of members) {
    if (scope.has(m.pjId)) out.add(m.workerId);
  }
  return Array.from(out);
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/lib/aggregate/tree.test.ts
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
npm run format
git add src/lib/aggregate/tree.ts src/lib/aggregate/tree.test.ts
git commit -m "feat(aggregate): pj ツリー操作と契約ノード/葉の述語を追加"
```

---

### Task 4: `aggregate/plan.ts` — 予定工数の導出

**Files:**

- Create: `src/lib/aggregate/plan.ts`
- Test: `src/lib/aggregate/plan.test.ts`

**Interfaces:**

- Consumes: `types.ts` の `Task`
- Produces:
  - `plannedHoursOf(task: Task): number`
  - `sumPlannedHours(tasks: Task[]): number`
  - `tasksInYear(tasks: Task[], year: number): Task[]`

**このファイルも `TaskEntry` と `progress.ts` を import してはならない。**

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect } from "vitest";
import type { Task } from "../types";
import { plannedHoursOf, sumPlannedHours, tasksInYear } from "./plan";

const task = (startAt: string, endAt: string, id = "t"): Task => ({
  id,
  trackerPjId: "p",
  assigneeId: "w",
  title: id,
  startAt,
  endAt,
});

describe("plannedHoursOf", () => {
  it("同日内の枠の長さを時間で返す", () => {
    expect(
      plannedHoursOf(
        task("2026-02-10T10:00:00+09:00", "2026-02-10T18:00:00+09:00")
      )
    ).toBe(8);
  });

  it("分単位の端数を保つ", () => {
    expect(
      plannedHoursOf(
        task("2026-02-10T10:00:00+09:00", "2026-02-10T10:30:00+09:00")
      )
    ).toBe(0.5);
  });

  it("日をまたぐ枠は経過時間そのままを返す（夜間も数える）", () => {
    expect(
      plannedHoursOf(
        task("2026-02-10T22:00:00+09:00", "2026-02-11T02:00:00+09:00")
      )
    ).toBe(4);
  });

  it("タイムゾーン表記が違っても同じ瞬間なら同じ値になる", () => {
    expect(
      plannedHoursOf(task("2026-02-10T01:00:00Z", "2026-02-10T10:00:00+09:00"))
    ).toBe(0);
  });

  it("パースできない日時は 0 を返す", () => {
    expect(plannedHoursOf(task("きのう", "きょう"))).toBe(0);
  });
});

describe("sumPlannedHours", () => {
  it("合計する", () => {
    const ts = [
      task("2026-02-10T10:00:00+09:00", "2026-02-10T18:00:00+09:00", "a"),
      task("2026-02-11T10:00:00+09:00", "2026-02-11T12:00:00+09:00", "b"),
    ];
    expect(sumPlannedHours(ts)).toBe(10);
  });

  it("空配列は 0", () => {
    expect(sumPlannedHours([])).toBe(0);
  });
});

describe("tasksInYear", () => {
  it("開始日時の年で絞る", () => {
    const ts = [
      task("2026-02-10T10:00:00+09:00", "2026-02-10T18:00:00+09:00", "a"),
      task("2027-02-10T10:00:00+09:00", "2027-02-10T18:00:00+09:00", "b"),
    ];
    expect(tasksInYear(ts, 2026).map((t) => t.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/lib/aggregate/plan.test.ts
```

Expected: FAIL（`./plan` が存在しない）

- [ ] **Step 3: `src/lib/aggregate/plan.ts` を実装する**

```ts
/**
 * 予定工数の導出。
 *
 * task は Google Calendar のイベント相当なので、予定工数は枠の長さそのもの。
 * 手入力の予定工数は持たない。
 *
 * 営業時間換算（1日8時間・平日のみ）にしたくなった場合、差し替えるのは
 * plannedHoursOf() 1本だけで済む。
 *
 * このファイルは実績拡張層（TaskEntry / progress.ts）を import しない。
 */
import type { Task } from "../types";

const MS_PER_HOUR = 3_600_000;

/** task の予定工数（時間）。パースできない場合は 0。 */
export function plannedHoursOf(task: Task): number {
  const start = Date.parse(task.startAt);
  const end = Date.parse(task.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const hours = (end - start) / MS_PER_HOUR;
  return hours > 0 ? hours : 0;
}

export const sumPlannedHours = (tasks: Task[]): number =>
  tasks.reduce((a, t) => a + plannedHoursOf(t), 0);

/** 開始日時の年で絞る。 */
export const tasksInYear = (tasks: Task[], year: number): Task[] =>
  tasks.filter((t) => new Date(t.startAt).getFullYear() === year);
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/lib/aggregate/plan.test.ts
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
npm run format
git add src/lib/aggregate/plan.ts src/lib/aggregate/plan.test.ts
git commit -m "feat(aggregate): task の期間から予定工数を導出する層を追加"
```

---

### Task 5: `aggregate/progress.ts` — 実績集計（拡張層）

**Files:**

- Create: `src/lib/aggregate/progress.ts`
- Test: `src/lib/aggregate/progress.test.ts`
- Delete: `src/lib/aggregate.ts`, `src/lib/aggregate.test.ts`

**Interfaces:**

- Consumes: `tree.ts` の `descendantIds` `leafPjs` `contractNodes`、`plan.ts` の `sumPlannedHours` `tasksInYear`
- Produces:

  - `filterByYear(entries: TaskEntry[], year: number): TaskEntry[]`
  - `availableYears(entries: TaskEntry[], tasks: Task[], current: number): number[]`
  - `monthlyStackByLeaf(entries, tasks, leaves, year): Array<Record<string, number | string>>`
  - `annualByLeaf(entries, tasks, leaves, year): Array<{ pj: Pj; hours: number }>`
  - `workerHours(entries, tasks, workers, year): WorkerHours[]`
  - `contractProgress(entries, tasks, pjs, year): ContractProgress[]`
  - `orgTotals(entries, tasks, pjs, trackers, year): Totals`
  - 型 `WorkerHours` `ContractProgress` `Totals`

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect } from "vitest";
import type { Pj, Task, TaskEntry, Tracker, Worker } from "../types";
import {
  filterByYear,
  availableYears,
  monthlyStackByLeaf,
  annualByLeaf,
  workerHours,
  contractProgress,
  orgTotals,
} from "./progress";

//  受注(契約) ─ サブ ─ 葉1
//                └──── 葉2
const PJS: Pj[] = [
  {
    id: "受注",
    name: "受注",
    color: "#000",
    fiscalYear: 2026,
    budgetAmount: 100,
  },
  { id: "サブ", parentId: "受注", name: "サブ", color: "#000" },
  { id: "葉1", parentId: "サブ", name: "葉1", color: "#111" },
  { id: "葉2", parentId: "サブ", name: "葉2", color: "#222" },
];
const TRACKERS: Tracker[] = [{ pjId: "葉1" }, { pjId: "葉2" }];
const LEAVES = PJS.filter((p) => p.id === "葉1" || p.id === "葉2");

const WORKERS: Worker[] = [
  { id: "w1", name: "佐藤" },
  { id: "w2", name: "鈴木" },
];

// 葉1: 8h 枠 (w1) / 葉2: 2h 枠 (w2)
const TASKS: Task[] = [
  {
    id: "t1",
    trackerPjId: "葉1",
    assigneeId: "w1",
    title: "t1",
    startAt: "2026-02-10T10:00:00+09:00",
    endAt: "2026-02-10T18:00:00+09:00",
  },
  {
    id: "t2",
    trackerPjId: "葉2",
    assigneeId: "w2",
    title: "t2",
    startAt: "2026-03-05T10:00:00+09:00",
    endAt: "2026-03-05T12:00:00+09:00",
  },
];

const ENTRIES: TaskEntry[] = [
  { id: "e1", taskId: "t1", year: 2026, month: 2, hours: 6 },
  { id: "e2", taskId: "t2", year: 2026, month: 3, hours: 3 },
  { id: "e3", taskId: "t1", year: 2025, month: 12, hours: 99 },
];

describe("filterByYear", () => {
  it("指定年だけ残す", () => {
    expect(filterByYear(ENTRIES, 2026).map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});

describe("availableYears", () => {
  it("実績と task の年の和集合を降順で返す", () => {
    expect(availableYears(ENTRIES, TASKS, 2028)).toEqual([2028, 2026, 2025]);
  });

  it("現在年が既にあっても重複しない", () => {
    expect(availableYears(ENTRIES, TASKS, 2026)).toEqual([2026, 2025]);
  });
});

describe("monthlyStackByLeaf", () => {
  it("task 経由で葉pjへ寄せて12ヶ月ぶん返す", () => {
    const rows = monthlyStackByLeaf(ENTRIES, TASKS, LEAVES, 2026);
    expect(rows).toHaveLength(12);
    expect(rows[1]).toMatchObject({ month: "2月", 葉1: 6, 葉2: 0, total: 6 });
    expect(rows[2]).toMatchObject({ month: "3月", 葉1: 0, 葉2: 3, total: 3 });
  });
});

describe("annualByLeaf", () => {
  it("葉別の年間合計を降順で返す", () => {
    const rows = annualByLeaf(ENTRIES, TASKS, LEAVES, 2026);
    expect(rows.map((r) => [r.pj.id, r.hours])).toEqual([
      ["葉1", 6],
      ["葉2", 3],
    ]);
  });
});

describe("workerHours", () => {
  it("task.assigneeId 経由でワーカーに寄せる", () => {
    expect(workerHours(ENTRIES, TASKS, WORKERS, 2026)).toEqual([
      { worker: WORKERS[0], totalHours: 6 },
      { worker: WORKERS[1], totalHours: 3 },
    ]);
  });
});

describe("contractProgress", () => {
  it("契約ノードのサブツリー配下 task の予定と実績を集計する", () => {
    const [row] = contractProgress(ENTRIES, TASKS, PJS, 2026);
    expect(row.pj.id).toBe("受注");
    expect(row.plannedHours).toBe(10); // 8h + 2h
    expect(row.actualHours).toBe(9); // 6h + 3h
    expect(row.consumption).toBe(90);
  });

  it("task が無ければ予定 0・消化率 0 で落ちない", () => {
    const [row] = contractProgress([], [], PJS, 2026);
    expect(row.plannedHours).toBe(0);
    expect(row.consumption).toBe(0);
  });
});

describe("orgTotals", () => {
  it("全体の実績・予定・消化率・稼働葉数を返す", () => {
    const t = orgTotals(ENTRIES, TASKS, PJS, TRACKERS, 2026);
    expect(t.totalHours).toBe(9);
    expect(t.totalPlanned).toBe(10);
    expect(t.consumption).toBe(90);
    expect(t.activeLeaves).toBe(2);
  });

  it("予定 0 のとき消化率は 0（ゼロ除算しない）", () => {
    const t = orgTotals([], [], PJS, TRACKERS, 2026);
    expect(t.consumption).toBe(0);
    expect(t.activeLeaves).toBe(0);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/lib/aggregate/progress.test.ts
```

Expected: FAIL（`./progress` が存在しない）

- [ ] **Step 3: `src/lib/aggregate/progress.ts` を実装する**

```ts
/**
 * 実績の集計（実績拡張層）。
 *
 * この層はコア層（tree.ts / plan.ts）を一方向に参照する。逆は無い。
 */
import type { Pj, Task, TaskEntry, Tracker, Worker } from "../types";
import { MONTHS, MONTH_LABELS } from "../types";
import { contractNodes, descendantIds, leafPjs } from "./tree";
import { sumPlannedHours, tasksInYear } from "./plan";

const pct = (actual: number, planned: number): number =>
  planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0;

export const filterByYear = (entries: TaskEntry[], year: number): TaskEntry[] =>
  entries.filter((e) => e.year === year);

/** 実績と task の両方に現れる年の一覧（降順）。 */
export function availableYears(
  entries: TaskEntry[],
  tasks: Task[],
  current: number
): number[] {
  const years = new Set<number>(entries.map((e) => e.year));
  for (const t of tasks) {
    const y = new Date(t.startAt).getFullYear();
    if (Number.isFinite(y)) years.add(y);
  }
  years.add(current);
  return Array.from(years).sort((a, b) => b - a);
}

/** taskId -> その task が属する葉pjのid。 */
const taskToLeaf = (tasks: Task[]): Map<string, string> =>
  new Map(tasks.map((t) => [t.id, t.trackerPjId]));

/** taskId -> 担当ワーカーid。 */
const taskToWorker = (tasks: Task[]): Map<string, string> =>
  new Map(tasks.map((t) => [t.id, t.assigneeId]));

/** 月×葉pj の積み上げ用データ。Recharts にそのまま渡せる形。 */
export function monthlyStackByLeaf(
  entries: TaskEntry[],
  tasks: Task[],
  leaves: Pj[],
  year: number
): Array<Record<string, number | string>> {
  const yEntries = filterByYear(entries, year);
  const leafOf = taskToLeaf(tasks);
  return MONTHS.map((month, i) => {
    const row: Record<string, number | string> = { month: MONTH_LABELS[i] };
    let total = 0;
    for (const leaf of leaves) {
      const hours = yEntries
        .filter((e) => e.month === month && leafOf.get(e.taskId) === leaf.id)
        .reduce((a, e) => a + e.hours, 0);
      row[leaf.id] = hours;
      total += hours;
    }
    row.total = total;
    return row;
  });
}

/** 葉pj別 年間合計時間。 */
export function annualByLeaf(
  entries: TaskEntry[],
  tasks: Task[],
  leaves: Pj[],
  year: number
): Array<{ pj: Pj; hours: number }> {
  const yEntries = filterByYear(entries, year);
  const leafOf = taskToLeaf(tasks);
  return leaves
    .map((pj) => ({
      pj,
      hours: yEntries
        .filter((e) => leafOf.get(e.taskId) === pj.id)
        .reduce((a, e) => a + e.hours, 0),
    }))
    .sort((a, b) => b.hours - a.hours);
}

export type WorkerHours = { worker: Worker; totalHours: number };

/** ワーカー別 年間投下工数。担当者は task.assigneeId から引く。 */
export function workerHours(
  entries: TaskEntry[],
  tasks: Task[],
  workers: Worker[],
  year: number
): WorkerHours[] {
  const yEntries = filterByYear(entries, year);
  const workerOf = taskToWorker(tasks);
  return workers
    .map((worker) => ({
      worker,
      totalHours: yEntries
        .filter((e) => workerOf.get(e.taskId) === worker.id)
        .reduce((a, e) => a + e.hours, 0),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

export type ContractProgress = {
  pj: Pj;
  /** 配下 task の枠の長さの合計（導出値）。 */
  plannedHours: number;
  actualHours: number;
  /** 実績 / 予定（%）。予定0なら0。 */
  consumption: number;
};

/**
 * 契約ノード別 工数の充足状況。
 * 予定は配下 task の期間から導出するので、task が1件も無い契約の予定は 0 になる。
 */
export function contractProgress(
  entries: TaskEntry[],
  tasks: Task[],
  pjs: Pj[],
  year: number
): ContractProgress[] {
  const yEntries = filterByYear(entries, year);
  const yTasks = tasksInYear(tasks, year);
  return contractNodes(pjs)
    .map((pj) => {
      const scope = new Set(descendantIds(pj.id, pjs));
      const scoped = yTasks.filter((t) => scope.has(t.trackerPjId));
      const taskIds = new Set(scoped.map((t) => t.id));
      const actualHours = yEntries
        .filter((e) => taskIds.has(e.taskId))
        .reduce((a, e) => a + e.hours, 0);
      const plannedHours = sumPlannedHours(scoped);
      return {
        pj,
        plannedHours,
        actualHours,
        consumption: pct(actualHours, plannedHours),
      };
    })
    .sort((a, b) => b.plannedHours - a.plannedHours);
}

export type Totals = {
  totalHours: number;
  totalPlanned: number;
  /** 実績 / 予定（%） */
  consumption: number;
  /** その年に実績のある葉pjの数。 */
  activeLeaves: number;
};

export function orgTotals(
  entries: TaskEntry[],
  tasks: Task[],
  pjs: Pj[],
  trackers: Tracker[],
  year: number
): Totals {
  const yEntries = filterByYear(entries, year);
  const yTasks = tasksInYear(tasks, year);
  const leafOf = taskToLeaf(tasks);
  const totalHours = yEntries.reduce((a, e) => a + e.hours, 0);
  const totalPlanned = sumPlannedHours(yTasks);
  const activeLeaves = leafPjs(pjs, trackers).filter((leaf) =>
    yEntries.some((e) => e.hours > 0 && leafOf.get(e.taskId) === leaf.id)
  ).length;
  return {
    totalHours,
    totalPlanned,
    consumption: pct(totalHours, totalPlanned),
    activeLeaves,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/lib/aggregate/progress.test.ts
```

Expected: PASS

- [ ] **Step 5: 旧集計を削除**

```bash
git rm src/lib/aggregate.ts src/lib/aggregate.test.ts
```

- [ ] **Step 6: コミット**

```bash
npm run format
git add src/lib/aggregate/progress.ts src/lib/aggregate/progress.test.ts
git commit -m "feat(aggregate): 実績集計を拡張層として再実装し旧 aggregate を削除"
```

---

### Task 6: 依存の向きをテストで固定する

**Files:**

- Create: `src/lib/aggregate/layering.test.ts`

**Interfaces:**

- Consumes: Task 3〜5 で作った `tree.ts` `plan.ts` `progress.ts` のソース
- Produces: なし（回帰防止のみ）

- [ ] **Step 1: テストを書く**

コア層のファイルが実績拡張層を参照していないことを、ソースの import 文から機械的に確認する。

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// ESM で動くため __dirname は使えない。
const DIR = fileURLToPath(new URL(".", import.meta.url));

const read = (file: string) => readFileSync(join(DIR, file), "utf8");

/** import 文だけを抜き出す（コメント中の言及を拾わないため）。 */
const importLines = (src: string): string[] =>
  src.split("\n").filter((l) => /^\s*import\s/.test(l));

describe("層の依存の向き", () => {
  const CORE_FILES = ["tree.ts", "plan.ts"];

  for (const file of CORE_FILES) {
    it(`${file} は progress.ts を import しない`, () => {
      const imports = importLines(read(file)).join("\n");
      expect(imports).not.toMatch(/["']\.\/progress["']/);
    });

    it(`${file} は TaskEntry を import しない`, () => {
      const imports = importLines(read(file)).join("\n");
      expect(imports).not.toMatch(/\bTaskEntry\b/);
    });
  }

  it("progress.ts はコア層を import してよい（向きが逆でないことの確認）", () => {
    const imports = importLines(read("progress.ts")).join("\n");
    expect(imports).toMatch(/["']\.\/tree["']/);
    expect(imports).toMatch(/["']\.\/plan["']/);
  });
});
```

- [ ] **Step 2: テストが通ることを確認**

```bash
npx vitest run src/lib/aggregate/layering.test.ts
```

Expected: PASS（Task 3〜5 を正しく実装していれば最初から通る）

- [ ] **Step 3: テストが本当に効くことを確かめる**

`src/lib/aggregate/tree.ts` の import 行の直後に一時的に次の1行を足す。

```ts
import type { TaskEntry } from "../types";
```

再実行して **FAIL する**ことを確認したうえで、足した行を削除し、再度 PASS することを確認する。

```bash
npx vitest run src/lib/aggregate/layering.test.ts
```

- [ ] **Step 4: コミット**

```bash
npm run format
git add src/lib/aggregate/layering.test.ts
git commit -m "test(aggregate): コア層が実績層に依存しないことを固定"
```

---

### Task 7: ストアの再構成

**Files:**

- Create: `src/lib/store/types.ts`
- Create: `src/lib/store/mappers.ts`
- Create: `src/lib/store/mappers.test.ts`
- Create: `src/lib/store/crud.ts`
- Create: `src/lib/store/core.ts`
- Create: `src/lib/store/actuals.ts`
- Create: `src/lib/store/index.ts`
- Delete: `src/lib/store.ts`

**Interfaces:**

- Consumes: `types.ts`、`supabase.ts` の `Db*`、`schemas.ts`
- Produces:
  - `store/types.ts`: `Status` `Shared`
  - `mappers.ts`: `num` `toWorker` `toPj` `toPjMember` `toTracker` `toIssue` `toTask` `toTaskEntry`
  - `crud.ts`: `fail(set, e)` `check(schema, value)` `patchOf(map)`
  - `index.ts`: `useStore` — state `{ workers, pjs, pjMembers, trackers, issues, tasks, taskEntries, year, status, error, loaded }`、actions は下記

> **spec からの意図的な逸脱**: spec §5-1 は `crud.ts` を「テーブル名・変換関数・スキーマを渡すだけ」の汎用ファクトリとして描いていたが、Supabase のクエリビルダを汎用化すると `insert` の snake_case 組み立てが型を失い `any` が必要になる（ESLint で禁止）。ここでは共通化を `fail` / `check` / `patchOf` の3本に留め、各アクションは明示的に書く。行数削減は spec の見積り（655→300）より小さく、**おおよそ 655 → 480 行**（4ファイル合計）になる。

`useStore` が公開する action（後続タスクが名前で依存する）:

```
load() / setYear(year)
addWorker(input) / updateWorker(id, patch) / removeWorker(id)
addPj(input) => Promise<string | undefined> / updatePj(id, patch) / removePj(id)
addPjMember(pjId, workerId) / removePjMember(pjId, workerId)
attachTracker(input) / updateTracker(pjId, patch) / detachTracker(pjId)
addIssue(input) => Promise<string | undefined> / updateIssue(id, patch) / removeIssue(id)
addTask(input) => Promise<string | undefined> / updateTask(id, patch) / removeTask(id)
setTaskHours({ taskId, year, month, hours })
```

- [ ] **Step 1: mappers の失敗するテストを書く**

`src/lib/store/mappers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toPj, toTracker, toIssue, toTask, toTaskEntry } from "./mappers";

describe("toPj", () => {
  it("null を undefined に、numeric 文字列を数値に変換する", () => {
    const pj = toPj({
      id: "p1",
      parent_id: null,
      name: "A社",
      color: "#000000",
      owner_worker_id: null,
      fiscal_year: null,
      budget_amount: "1000.50",
    });
    expect(pj).toEqual({
      id: "p1",
      parentId: undefined,
      name: "A社",
      color: "#000000",
      ownerWorkerId: undefined,
      fiscalYear: undefined,
      budgetAmount: 1000.5,
    });
  });

  it("budget_amount が 0 のとき undefined にしない", () => {
    const pj = toPj({
      id: "p1",
      parent_id: null,
      name: "x",
      color: "#000000",
      owner_worker_id: null,
      fiscal_year: null,
      budget_amount: 0,
    });
    expect(pj.budgetAmount).toBe(0);
  });
});

describe("toTracker", () => {
  it("日付 null を undefined にする", () => {
    expect(
      toTracker({ pj_id: "p1", start_date: null, end_date: null })
    ).toEqual({
      pjId: "p1",
      startDate: undefined,
      endDate: undefined,
    });
  });
});

describe("toIssue", () => {
  it("担当者 null を undefined にする（宙ぶらりん）", () => {
    const issue = toIssue({
      id: "i1",
      tracker_pj_id: "p1",
      parent_id: null,
      assignee_id: null,
      title: "改善",
      due_date: null,
      status: "open",
    });
    expect(issue.assigneeId).toBeUndefined();
    expect(issue.status).toBe("open");
  });

  it("未知の status は open に丸める", () => {
    const issue = toIssue({
      id: "i1",
      tracker_pj_id: "p1",
      parent_id: null,
      assignee_id: null,
      title: "改善",
      due_date: null,
      status: "wontfix",
    });
    expect(issue.status).toBe("open");
  });
});

describe("toTask", () => {
  it("issue_id null を undefined にする", () => {
    const task = toTask({
      id: "t1",
      tracker_pj_id: "p1",
      issue_id: null,
      assignee_id: "w1",
      title: "作業",
      start_at: "2026-02-10T01:00:00Z",
      end_at: "2026-02-10T09:00:00Z",
    });
    expect(task.issueId).toBeUndefined();
    expect(task.assigneeId).toBe("w1");
  });
});

describe("toTaskEntry", () => {
  it("numeric 文字列の工数を数値にする", () => {
    const e = toTaskEntry({
      id: "e1",
      task_id: "t1",
      year: 2026,
      month: 2,
      hours: "6.5",
    });
    expect(e.hours).toBe(6.5);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/lib/store/mappers.test.ts
```

Expected: FAIL（`./mappers` が存在しない）

- [ ] **Step 3: `src/lib/store/mappers.ts` を実装する**

```ts
/**
 * DB (snake_case) → アプリ型 (camelCase) の変換。
 * snake_case を書いてよいのはこのファイルと各スライスの書き込み部分だけ。
 */
import type {
  Worker,
  Pj,
  PjMember,
  Tracker,
  Issue,
  IssueStatus,
  Task,
  TaskEntry,
} from "../types";
import { ISSUE_STATUSES } from "../types";
import type {
  DbWorker,
  DbPj,
  DbPjMember,
  DbTracker,
  DbIssue,
  DbTask,
  DbTaskEntry,
} from "../supabase";

/** numeric 列は string で返ることがある。null/undefined は 0 に落とす。 */
export const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : Number(v);

/** null を undefined に。0 や空文字は保つ。 */
const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

const optNum = (v: number | string | null): number | undefined =>
  v === null ? undefined : Number(v);

const toIssueStatus = (v: string): IssueStatus =>
  (ISSUE_STATUSES as readonly string[]).includes(v)
    ? (v as IssueStatus)
    : "open";

export const toWorker = (r: DbWorker): Worker => ({ id: r.id, name: r.name });

export const toPj = (r: DbPj): Pj => ({
  id: r.id,
  parentId: opt(r.parent_id),
  name: r.name,
  color: r.color,
  ownerWorkerId: opt(r.owner_worker_id),
  fiscalYear: opt(r.fiscal_year),
  budgetAmount: optNum(r.budget_amount),
});

export const toPjMember = (r: DbPjMember): PjMember => ({
  pjId: r.pj_id,
  workerId: r.worker_id,
});

export const toTracker = (r: DbTracker): Tracker => ({
  pjId: r.pj_id,
  startDate: opt(r.start_date),
  endDate: opt(r.end_date),
});

export const toIssue = (r: DbIssue): Issue => ({
  id: r.id,
  trackerPjId: r.tracker_pj_id,
  parentId: opt(r.parent_id),
  assigneeId: opt(r.assignee_id),
  title: r.title,
  dueDate: opt(r.due_date),
  status: toIssueStatus(r.status),
});

export const toTask = (r: DbTask): Task => ({
  id: r.id,
  trackerPjId: r.tracker_pj_id,
  issueId: opt(r.issue_id),
  assigneeId: r.assignee_id,
  title: r.title,
  startAt: r.start_at,
  endAt: r.end_at,
});

export const toTaskEntry = (r: DbTaskEntry): TaskEntry => ({
  id: r.id,
  taskId: r.task_id,
  year: r.year,
  month: r.month,
  hours: num(r.hours),
});
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/lib/store/mappers.test.ts
```

Expected: PASS

- [ ] **Step 5: `src/lib/store/types.ts` を実装する**

`index.ts` と各スライスの相互 import を避けるため、共有部分の型だけを独立させる。

```ts
export type Status = "idle" | "loading" | "ready" | "unconfigured" | "error";

/** どのスライスにも属さない共有状態。 */
export type Shared = {
  year: number;
  status: Status;
  error: string | null;
  loaded: boolean;
  setYear: (year: number) => void;
  load: () => Promise<void>;
};
```

- [ ] **Step 6: `src/lib/store/crud.ts` を実装する**

```ts
"use client";

import type { z } from "zod";
import { notify } from "../notify";
import { validate } from "../schemas";
import type { Status } from "./types";

/** DB 例外を状態とトーストの両方へ反映する。 */
export function fail(
  set: (p: { status: Status; error: string }) => void,
  e: unknown
): void {
  const msg = e instanceof Error ? e.message : String(e);
  set({ status: "error", error: msg });
  notify.error(`データ操作に失敗しました: ${msg}`);
  console.error("[store]", msg);
}

/**
 * 入力をスキーマで検証する。失敗時はトーストで通知して null を返す。
 * 各 add/update アクションの先頭で使う。
 */
export function check<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = validate(schema, value);
  if (!result.ok) {
    notify.error(result.message);
    return null;
  }
  return result.data;
}

/** undefined のキーを落として snake_case のパッチを組む。 */
export function patchOf(
  map: Record<string, unknown | undefined>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
```

- [ ] **Step 7: `src/lib/store/core.ts` を実装する**

コア層のスライス。`src/lib/store.ts` の既存アクションの書き方（`if (!supabase) return;` → `check()` → 楽観的更新 → `try/catch` でロールバック）をそのまま踏襲する。`git show HEAD~5:src/lib/store.ts` などで旧実装を参照してよい。

```ts
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
    if (!check(workerInputSchema.partial(), patch)) return;
    const prev = get().workers;
    set({ workers: prev.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
    try {
      const { error } = await supabase
        .from("workers")
        .update(patchOf({ name: patch.name }))
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
      set({
        workers: get().workers.filter((w) => w.id !== id),
        pjMembers: get().pjMembers.filter((m) => m.workerId !== id),
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
    if (!check(pjPatchSchema, patch)) return;
    const prev = get().pjs;
    set({ pjs: prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    try {
      const { error } = await supabase
        .from("pj")
        .update(
          patchOf({
            parent_id:
              patch.parentId === undefined
                ? undefined
                : (patch.parentId ?? null),
            name: patch.name,
            color: patch.color || undefined,
            owner_worker_id:
              patch.ownerWorkerId === undefined
                ? undefined
                : (patch.ownerWorkerId ?? null),
            fiscal_year:
              patch.fiscalYear === undefined
                ? undefined
                : (patch.fiscalYear ?? null),
            budget_amount:
              patch.budgetAmount === undefined
                ? undefined
                : (patch.budgetAmount ?? null),
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
    if (!check(trackerPatchSchema, patch)) return;
    const prev = get().trackers;
    set({
      trackers: prev.map((t) => (t.pjId === pjId ? { ...t, ...patch } : t)),
    });
    try {
      const { error } = await supabase
        .from("tracker")
        .update(
          patchOf({
            start_date:
              patch.startDate === undefined
                ? undefined
                : (patch.startDate ?? null),
            end_date:
              patch.endDate === undefined ? undefined : (patch.endDate ?? null),
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
    if (!check(issuePatchSchema, patch)) return;
    const prev = get().issues;
    set({ issues: prev.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
    try {
      const { error } = await supabase
        .from("issues")
        .update(
          patchOf({
            parent_id:
              patch.parentId === undefined
                ? undefined
                : (patch.parentId ?? null),
            assignee_id:
              patch.assigneeId === undefined
                ? undefined
                : (patch.assigneeId ?? null),
            title: patch.title,
            due_date:
              patch.dueDate === undefined ? undefined : (patch.dueDate ?? null),
            status: patch.status,
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
    if (!check(taskPatchSchema, patch)) return;
    const prev = get().tasks;
    set({ tasks: prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
    try {
      const { error } = await supabase
        .from("tasks")
        .update(
          patchOf({
            issue_id:
              patch.issueId === undefined ? undefined : (patch.issueId ?? null),
            assignee_id: patch.assigneeId,
            title: patch.title,
            start_at: patch.startAt,
            end_at: patch.endAt,
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
```

- [ ] **Step 8: `src/lib/store/actuals.ts` を実装する**

旧 `store.ts` の `setHours`（590〜654行）と同じ楽観的更新の形を踏襲する。

```ts
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
```

- [ ] **Step 9: `src/lib/store/index.ts` を実装する**

```ts
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
```

- [ ] **Step 10: 旧ストアを削除**

```bash
git rm src/lib/store.ts
```

`import { useStore } from "@/lib/store"` は `src/lib/store/index.ts` に解決されるため、既存の import パスは変更不要。

- [ ] **Step 11: mappers のテストが引き続き通ることを確認**

```bash
npx vitest run src/lib/store/mappers.test.ts
```

Expected: PASS

- [ ] **Step 12: コミット**

```bash
npm run format
git add src/lib/store
git commit -m "refactor(store): コア層と実績層のスライスに分割して再実装"
```

---

### Task 8: 旧画面の撤去と `/pj` ツリー画面

**Files:**

- Delete: `src/app/clients/page.tsx`, `src/app/clients/new/page.tsx`, `src/app/clients/[id]/page.tsx`
- Delete: `src/app/orders/page.tsx`, `src/app/orders/new/page.tsx`, `src/app/orders/[id]/page.tsx`
- Delete: `src/app/projects/page.tsx`, `src/app/projects/new/page.tsx`, `src/app/projects/[id]/page.tsx`
- Create: `src/app/pj/page.tsx`
- Create: `src/app/pj/[id]/page.tsx`
- Modify: `src/components/Sidebar.tsx:7-14`

**Interfaces:**

- Consumes: `useStore`（Task 7）、`aggregate/tree.ts` の `childrenOf` `isLeaf` `isContractNode` `breadcrumb` `effectiveMembers`
- Produces: ルート `/pj` と `/pj/[id]`

- [ ] **Step 1: 旧画面9本を削除**

```bash
git rm -r src/app/clients src/app/orders src/app/projects
```

- [ ] **Step 2: `src/components/Sidebar.tsx` のリンクを差し替える**

7〜14行目の `LINKS` を以下にする。他は変更しない。

```ts
const LINKS = [
  { href: "/", label: "ダッシュボード" },
  { href: "/pj", label: "プロジェクト" },
  { href: "/actuals", label: "実績入力" },
  { href: "/master", label: "マスタ" },
];
```

- [ ] **Step 3: `src/app/pj/page.tsx` を作る**

ツリー一覧。`childrenOf(undefined, pjs)` からルートを取り、再帰コンポーネントで描画する。行のスタイルは削除した `src/app/projects/page.tsx` を `git show` で参照し、既存のトーン（`rounded-xl border border-slate-200 bg-white shadow-sm`）に合わせる。

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { childrenOf, isLeaf, isContractNode } from "@/lib/aggregate/tree";
import type { Pj } from "@/lib/types";

function TreeRow({ pj, depth }: { pj: Pj; depth: number }) {
  const { pjs, trackers } = useStore();
  const children = childrenOf(pj.id, pjs);
  const leaf = isLeaf(pj.id, trackers);
  const [open, setOpen] = useState(true);

  return (
    <>
      <div
        className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm"
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        {children.length > 0 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "折りたたむ" : "展開する"}
            className="w-4 text-slate-400 hover:text-slate-600"
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: pj.color }}
        />
        <Link
          href={`/pj/${pj.id}`}
          className="font-medium text-slate-700 hover:text-indigo-600 hover:underline"
        >
          {pj.name}
        </Link>
        {isContractNode(pj) && (
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
      {open &&
        children.map((c) => <TreeRow key={c.id} pj={c} depth={depth + 1} />)}
    </>
  );
}

export default function PjTreePage() {
  const { pjs, addPj } = useStore();
  const [name, setName] = useState("");
  const roots = childrenOf(undefined, pjs);

  const create = async () => {
    if (!name.trim()) return;
    await addPj({ name });
    setName("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">プロジェクト</h1>
        <span className="text-sm text-slate-500">{pjs.length} ノード</span>
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ルートノード名（顧客など）"
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={create}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          追加
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {roots.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            ノードがありません。上のフォームから追加してください。
          </div>
        ) : (
          roots.map((r) => <TreeRow key={r.id} pj={r} depth={0} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/pj/[id]/page.tsx` を作る**

中間ノードと葉の両方を1画面で扱う。**どちらの操作を出すかは `isLeaf()` と子の有無から導出し、画面側で状態を宣言しない。**

含めるもの:

1. `breadcrumb(id, pjs)` によるパンくず
2. 基本情報の編集フォーム — `name` / `color` / `ownerWorkerId` / `fiscalYear` / `budgetAmount` を `updatePj(id, patch)` で保存
3. メンバー — `pjMembers` のうち `pjId === id` のものを一覧表示。`addPjMember` / `removePjMember`。あわせて `effectiveMembers(id, pjs, pjMembers)` を「有効メンバー（祖先からの継承を含む）」として読み取り専用で表示する
4. **子pjが1件もないノードにだけ**「tracker を付ける（葉にする）」ボタンを出す → `attachTracker({ pjId: id })`
5. **tracker を持つノードにだけ** 期間の編集（`updateTracker`）、`detachTracker`、および `/pj/[id]/issues` と `/pj/[id]/calendar` へのリンクを出す
6. **tracker を持たないノードにだけ** 子pjの追加フォームを出す → `addPj({ name, parentId: id })`
7. 削除ボタン → `removePj(id)` → `router.push("/pj")`

分岐の判定は必ず次の2つの値だけで行うこと。

```tsx
const leaf = isLeaf(id, trackers);
const children = childrenOf(id, pjs);
// tracker を付けられる = !leaf && children.length === 0
// 子を追加できる      = !leaf
```

`fiscalYear` / `budgetAmount` の入力欄には「入力すると受注（契約単位）として扱われます」という補助テキストを添える。`isContractNode` の意味を UI 側で再実装しないこと。

- [ ] **Step 5: 動作確認**

```bash
npm run dev
```

`http://localhost:3000/pj` を開き、以下を確認する。

1. サンプルデータの4段ツリー（社内 → 社内基盤刷新 受注 → フェーズ1 → 基盤設計）が入れ子で表示される
2. 「社内基盤刷新 受注」に「受注」バッジ、「基盤設計」に「葉」バッジが付く
3. 「基盤設計」を開くと期間の編集欄が出て、子pjの追加フォームは出ない
4. 「フェーズ1」を開くと子pjの追加フォームが出て、tracker を付けるボタンは出ない（子がいるため）
5. 「基盤設計」の有効メンバーに、祖先の「社内基盤刷新 受注」に登録された佐藤 太郎が含まれる

- [ ] **Step 6: コミット**

```bash
npm run format
git add -A src/app src/components/Sidebar.tsx
git commit -m "feat(ui): 顧客/受注/PJ の3画面を pj ツリー1画面へ統合"
```

---

### Task 9: `/pj/[id]/issues` — バックログ画面

**Files:**

- Create: `src/app/pj/[id]/issues/page.tsx`

**Interfaces:**

- Consumes: `useStore` の `issues` `workers` `addIssue` `updateIssue` `removeIssue`、`aggregate/tree.ts` の `isLeaf` `breadcrumb`
- Produces: ルート `/pj/[id]/issues`

- [ ] **Step 1: 画面を作る**

要件:

1. `isLeaf(id, trackers)` が false なら「この pj は葉ではないため issue を持てません」と表示して終了する
2. `issues.filter(i => i.trackerPjId === id)` を **親子の入れ子**で表示する。ルートは `parentId == null` のもの。子は `parentId === 親のid`
3. 各行に表示: タイトル / 担当者名（未設定は「未アサイン」）/ 期日 / status
4. status は `open` / `closed` のトグル → `updateIssue(id, { status })`
5. 担当者は `workers` から選ぶセレクト。**空を選べる**（宙ぶらりんを許す）→ `updateIssue(id, { assigneeId: undefined })`
6. 新規作成フォーム: タイトル（必須）/ 期日（任意）/ 担当者（任意）/ 親issue（任意、同じ葉pj内のissueのみ）→ `addIssue({ trackerPjId: id, ... })`
7. 削除 → `removeIssue(id)`

親issueのセレクトには**同じ `trackerPjId` の issue しか出さない**こと。DB トリガ `issue_same_tracker` が最終防衛線だが、UI で越境を選べてはならない。

`closed` の行はタイトルに `line-through text-slate-400` を当てる。

- [ ] **Step 2: 動作確認**

```bash
npm run dev
```

`/pj/<基盤設計のid>/issues` を開き、以下を確認する。

1. 「認証基盤の刷新」の下に「IdP 選定」が入れ子で表示される
2. 「IdP 選定」は closed なので打ち消し線が付く
3. 担当者セレクトを空にすると「未アサイン」になり、リロード後も保たれる
4. 中間ノード（例: フェーズ1）の `/pj/<id>/issues` を開くと「葉ではない」旨が表示される

- [ ] **Step 3: コミット**

```bash
npm run format
git add src/app/pj
git commit -m "feat(ui): 葉pj のバックログ画面を追加"
```

---

### Task 10: `/pj/[id]/calendar` — task 画面

**Files:**

- Create: `src/app/pj/[id]/calendar/page.tsx`

**Interfaces:**

- Consumes: `useStore` の `tasks` `issues` `workers` `pjMembers` `pjs` `year` `addTask` `updateTask` `removeTask`、`aggregate/tree.ts` の `isLeaf` `effectiveMembers`、`aggregate/plan.ts` の `plannedHoursOf` `sumPlannedHours` `tasksInYear`
- Produces: ルート `/pj/[id]/calendar`

- [ ] **Step 1: 画面を作る**

要件:

1. `isLeaf(id, trackers)` が false なら「この pj は葉ではないため task を持てません」と表示して終了する
2. その葉pjの task を、選択中の `year` で絞り（`tasksInYear`）、`startAt` の昇順で月ごとにグループ化して一覧表示する
3. 各行に表示: 開始日時 / 終了日時 / タイトル / 担当者名 / **予定工数 `plannedHoursOf(task)`（`h` 単位、小数1桁）** / 紐づく issue のタイトル（あれば）
4. ヘッダに `sumPlannedHours(該当年のtask)` を「予定工数 合計」として出す
5. 新規作成フォーム:
   - タイトル（必須）
   - 開始日時 / 終了日時 — `<input type="datetime-local">`。**値はローカル時刻の文字列（`2026-02-10T10:00`）で返るので、`new Date(v).toISOString()` に変換してから `addTask` に渡す**
   - 担当者（**必須**）— `effectiveMembers(id, pjs, pjMembers)` に含まれる worker だけを選択肢に出す
   - 紐づく issue（任意）— 同じ葉pjの issue のみ
6. 削除 → `removeTask(id)`
7. 担当者候補が0人のときは、セレクトの代わりに「この pj に有効メンバーがいません。`/pj/<id>` でメンバーを追加してください」と出してフォームを無効化する

**予定工数は表示のみで、入力欄を作らないこと。** 枠の長さが予定工数そのもの。

終了日時が開始日時の翌日以降になる入力を許可したうえで、その行に「日をまたぐ枠は夜間も工数に数えます」という注意書きを出す。

- [ ] **Step 2: 動作確認**

```bash
npm run dev
```

`/pj/<基盤設計のid>/calendar` を開き、以下を確認する。

1. 「IdP 比較検討」が 2026年2月のグループに表示され、予定工数が `8.0 h` と出る
2. 担当者セレクトに佐藤 太郎（祖先ノードのメンバー）が出る
3. 10:00〜10:30 の task を追加すると予定工数が `0.5 h` になる
4. 終了日時を開始日時と同じにして保存しようとすると「終了日時は開始日時より後にしてください」のトーストが出る

- [ ] **Step 3: コミット**

```bash
npm run format
git add src/app/pj
git commit -m "feat(ui): 葉pj のカレンダー(task)画面を追加"
```

---

### Task 11: `/actuals` — 実績入力画面の作り替え

**Files:**

- Delete: `src/app/worker-entries/page.tsx`, `src/app/worker-entries/[worker_id]/page.tsx`, `src/app/worker-entries/layout.tsx`
- Create: `src/app/actuals/layout.tsx`
- Create: `src/app/actuals/page.tsx`
- Create: `src/app/actuals/[worker_id]/page.tsx`

**Interfaces:**

- Consumes: `useStore` の `workers` `tasks` `taskEntries` `pjs` `year` `setTaskHours`、`aggregate/plan.ts` の `plannedHoursOf`
- Produces: ルート `/actuals` と `/actuals/[worker_id]`

- [ ] **Step 1: 旧画面を削除して layout / 一覧を移植**

```bash
git mv src/app/worker-entries src/app/actuals
```

`src/app/actuals/[worker_id]/` は残し、`layout.tsx` と `page.tsx` 内のリンク先 `/worker-entries` を `/actuals` に、見出しを「実績入力」に書き換える。`page.tsx`（ワーカー選択一覧）は worker を並べるだけなので、リンク先の変更以外はそのまま使える。

- [ ] **Step 2: `src/app/actuals/[worker_id]/page.tsx` を2階層グリッドに作り替える**

要件:

1. 対象ワーカーの task を絞る: `tasks.filter(t => t.assigneeId === workerId)`
2. それを `trackerPjId` で葉pjごとにグループ化する
3. **親行 = 葉pj** — 列は12ヶ月 + 計。値は配下 task の実績合計。**読み取り専用**
4. **子行 = task**（親行のクリックで開閉）— 列は12ヶ月 + 計。各セルは `<input type="number">` で `setTaskHours({ taskId, year, month, hours })` を呼ぶ
5. task 行のラベルには、タイトルと `plannedHoursOf(task)` を「予定 8.0h」の形で併記する
6. **task の期間と重なる月のセルに `bg-indigo-50` を当てる。** 重なるかは以下で判定する

```ts
const overlapsMonth = (task: Task, year: number, month: number): boolean => {
  const from = new Date(year, month - 1, 1).getTime();
  const to = new Date(year, month, 1).getTime(); // 翌月1日0時
  const s = Date.parse(task.startAt);
  const e = Date.parse(task.endAt);
  return s < to && e >= from;
};
```

7. 重ならない月にも**入力自体は許可する**（予定と実績はズレるため）。ハイライトの有無だけで区別する
8. 最下部に月ごとの総計行を置く
9. task が0件のときは「このワーカーに割り当てられた task がありません。プロジェクトのカレンダーから作成してください。」と表示する

グリッドの見た目（`sticky left-0`、`min-w-[760px]`、`tabular-nums` など）は削除前の `worker-entries/[worker_id]/page.tsx` を `git show HEAD~1:src/app/worker-entries/[worker_id]/page.tsx` で参照し、そのトーンを引き継ぐこと。

- [ ] **Step 3: 動作確認**

```bash
npm run dev
```

`/actuals` からワーカーを選び、以下を確認する。

1. 田中 誠を選ぶと「定常保守」の親行が出て、4月〜12月に実績が入っている
2. 親行を開くと「月次リリース作業」の task 行が出る
3. task の期間が 2026-04-20 なので4月のセルだけがハイライトされる
4. 5月のセル（ハイライトなし）にも入力でき、値が保存される
5. 子行の値を変えると親行の合計と最下部の総計が追随する

- [ ] **Step 4: コミット**

```bash
npm run format
git add -A src/app
git commit -m "feat(ui): 実績入力を葉pj/task の2階層グリッドへ作り替え"
```

---

### Task 12: ダッシュボードと Charts の差し替え

**Files:**

- Modify: `src/app/page.tsx`（全面書き直し）
- Modify: `src/components/Charts.tsx`
- Modify: `src/components/YearSelector.tsx`
- Modify: `src/app/master/page.tsx`

**Interfaces:**

- Consumes: `aggregate/progress.ts` の `orgTotals` `monthlyStackByLeaf` `annualByLeaf` `contractProgress` `workerHours` `availableYears`、`aggregate/tree.ts` の `leafPjs`
- Produces: なし（画面のみ）

- [ ] **Step 1: `src/components/Charts.tsx` を差し替える**

`projects: Project[]` を受けている props を `leaves: Pj[]` に変える。系列のキーは今までどおり pj の `id`、色は `pj.color`、ラベルは `pj.name`。`ProjectPie` が受けるデータ型は `Array<{ project: Project; hours: number }>` から `Array<{ pj: Pj; hours: number }>` に変わるので、参照している箇所を `d.pj.name` / `d.pj.color` に直す。コンポーネント名は `MonthlyStackedBar` / `LeafPie` にする。

- [ ] **Step 2: `src/components/YearSelector.tsx` を差し替える**

`availableYears(entries, current)` を呼んでいる箇所を `availableYears(taskEntries, tasks, year)` に変える。import 元は `@/lib/aggregate/progress`。

- [ ] **Step 3: `src/app/page.tsx` を書き直す**

構成は現行を踏襲しつつ、以下を変える。

1. import 元を `@/lib/aggregate/progress` と `@/lib/aggregate/tree` にする
2. `const leaves = leafPjs(pjs, trackers);` を求め、チャートに渡す
3. StatCard 4枚:
   - 年間 実績工数 — `totals.totalHours`
   - 予定工数 合計 — `totals.totalPlanned`、サブテキストは `` `task ${tasksInYear(tasks, year).length} 件から算出` ``
   - 消化率 — `totals.consumption`
   - 稼働PJ数 — `totals.activeLeaves`、サブテキストは `` `葉pj ${leaves.length} 件` ``
4. 「受注別 工数」テーブルを「契約ノード別 工数」に変える。**`当初` 列を削除する**（`initial_hours` はモデルから消えたため）。列は 受注 / 予定 / 実績 / 消化率 / 進捗バー
5. 「顧客」列を削除し、代わりに受注名を `/pj/<id>` へのリンクにする（親を辿りたい場合は詳細画面のパンくずで見られる）
6. データ空のときの案内文を「受注が未登録です。「受注」から追加してください。」から「契約ノードがありません。プロジェクトのノードに年度か予算を入力すると受注として集計されます。」に変える
7. ワーカー別テーブルは `workerHours(taskEntries, tasks, workers, year)` に差し替えるだけ

- [ ] **Step 4: `src/app/master/page.tsx` から teams を落とす**

チーム関連の state / フォーム / 一覧 / `addTeam` `updateTeam` `removeTeam` の呼び出しを全て削除し、ワーカーの CRUD だけを残す。見出しの「チーム」節ごと消す。

- [ ] **Step 5: 動作確認**

```bash
npm run dev
```

`http://localhost:3000/` を開き、以下を確認する。

1. 契約ノード別テーブルに3行（社内基盤刷新 受注 / ECサイト構築 受注 / 保守運用 受注）が出る
2. 「社内基盤刷新 受注」の予定が 13.0h（IdP比較検討 8h + 提案書ドラフト 5h。サブツリーを辿れている）になる
3. 月次積み上げグラフに葉pj名が凡例として出る
4. 稼働PJ数が 4 になる

- [ ] **Step 6: コミット**

```bash
npm run format
git add src/app/page.tsx src/components/Charts.tsx src/components/YearSelector.tsx src/app/master/page.tsx
git commit -m "feat(ui): ダッシュボードを契約ノード別集計へ差し替え"
```

---

### Task 13: 全体 green 回復とドキュメント更新

**Files:**

- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`（データモデルの記述がある場合）
- Modify: 型エラーの残る任意のファイル

**Interfaces:**

- Consumes: Task 1〜12 のすべて
- Produces: `npm run verify` と `npm run build` が通る状態

- [ ] **Step 1: 型チェックを通す**

```bash
npm run typecheck
```

エラーが出た箇所を順に潰す。**エラーを消すために `any` や `@ts-ignore` を使わないこと。** 旧型（`Project` `Order` `Client` `Team` `Milestone` `Assignment` `Achievement` `Entry`）への参照が残っていたら、それは消し忘れなので該当箇所を新モデルに直す。

- [ ] **Step 2: Lint を通す**

```bash
npm run lint
```

- [ ] **Step 3: テストを通す**

```bash
npm run test
```

Expected: `schemas` `tree` `plan` `progress` `layering` `mappers` `ui` `env` の全ファイルが PASS

- [ ] **Step 4: ビルドを通す**

```bash
npm run build
```

- [ ] **Step 5: `docs/ARCHITECTURE.md` を更新**

以下を書き換える。

1. 「レイヤ構成」の図に `aggregate/` の3ファイルと `store/` のスライス分割を反映する
2. 「データモデル」節の ASCII 図を新モデルに差し替える

```
pj (再帰ツリー)
 ├─ pj_members ── workers
 └─ tracker           ← 行の存在 = この pj は葉
      ├─ issues       ← 階層あり・期日・担当は任意
      └─ tasks        ← 階層なし・時刻付き期間・担当1名必須
           └─ task_entries   ← 実績拡張層（year × month × hours）
```

3. **「コア層は工数の行が1件もない状態で完結して使える」を不変条件として明記する**。予定工数は `plannedHoursOf()` で task の期間から導出し、手入力しないことも書く
4. 「拡張ポイント」節を書き換える。`assignments` / `achievements` への言及を削除し、代わりに以下を挙げる — `path text` によるSQL側サブツリー集計、`plannedHoursOf()` の営業時間換算への差し替え、issue の複数担当
5. 設計判断の根拠として [`docs/superpowers/specs/2026-08-19-pj-recursive-data-model-design.md`](specs/2026-08-19-pj-recursive-data-model-design.md) へのリンクを張る

- [ ] **Step 6: 旧モデル語の残骸を検索して潰す**

```bash
grep -rniE '\b(orders?|clients?|projects?|teams?|milestones?|assignments?|achievements)\b' \
  src docs README.md --include='*.ts' --include='*.tsx' --include='*.md' \
  | grep -v 'docs/data-model-redesign.md' \
  | grep -v 'docs/superpowers/'
```

ヒットしたもののうち、旧テーブル・旧型を指しているものを直す。`projects` が UI 上の表示語（「プロジェクト」）として残るのは問題ない。

- [ ] **Step 7: 最終確認**

```bash
npm run verify && npm run build
```

Expected: 全て成功

- [ ] **Step 8: コミット**

```bash
npm run format
git add -A
git commit -m "docs: アーキテクチャ文書を pj 再帰モデルへ更新し全体を green 化"
```

---

## 完了条件

- [ ] `npm run verify`（typecheck → lint → test）が通る
- [ ] `npm run build` が通る
- [ ] `supabase/schema.sql` が Supabase で最後まで実行でき、Task 1 Step 3 の検証クエリとトリガ確認が期待どおり
- [ ] `/`・`/pj`・`/pj/[id]`・`/pj/[id]/issues`・`/pj/[id]/calendar`・`/actuals/[worker_id]`・`/master` が全て動作する
- [ ] `src/lib/aggregate/layering.test.ts` が通り、コア層が実績層に依存していない
- [ ] 旧8テーブル・旧8型への参照がコードから消えている
