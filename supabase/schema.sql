-- 年間稼働トラッカー — Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください。
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
drop table if exists public.achievements cascade;
drop table if exists public.assignments cascade;
drop table if exists public.milestones cascade;
drop table if exists public.entries cascade;
drop table if exists public.projects cascade;
drop table if exists public.orders cascade;
drop table if exists public.clients cascade;
drop table if exists public.teams cascade;

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

  -- 深さ2: サブ受注（再帰が効いていることの実例。o1 をさらに束ねる）
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
