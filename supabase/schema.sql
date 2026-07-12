-- 年間稼働トラッカー — Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください。
--
-- データモデル:
--   clients ─1:N─ orders ─1:N─ projects ─(N:1)─ teams ─1:N─ workers
--   entries: worker × project × 年月
--
--   client（顧客）が受注（order）を出し、1つの受注は複数の細分化された
--   プロジェクトに分割される。各プロジェクトは1チームが担当し、チームには
--   複数のワーカーが所属する。工数（entries）はワーカー×プロジェクトの年月で記録する。

-- ========== テーブル ==========

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ワーカー（作業者）。チームには属さず、assignments でプロジェクトへ直接アサインする。
-- 稼働キャパは持たない（本システムはプロジェクト工数の充足を主眼とし、
-- ワーカー個人の稼働率は観測対象にしない）。
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 受注（order）: 顧客からの受注。複数年度にまたがるプロジェクトを束ねる契約単位。
-- 1つの受注が N 個の細分化されたプロジェクトを持つ。
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  -- 会計年度（受注の基点。複数年度管理のアンカー）
  fiscal_year integer,
  -- 社内担当ワーカー（任意）
  owner_worker_id uuid references public.workers(id) on delete set null,
  -- 当初工数（受注時点の初期見積, 時間）
  initial_hours numeric(10, 1) not null default 0,
  -- 予定工数（現時点の予定, 時間）
  planned_hours numeric(10, 1) not null default 0,
  -- 予算（金額）
  budget_amount numeric(14, 2),
  created_at timestamptz not null default now()
);

create index if not exists orders_client_idx on public.orders (client_id);
create index if not exists orders_fiscal_year_idx on public.orders (fiscal_year);

-- プロジェクト: 受注を細分化した作業単位。1チームが担当する。
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  color text not null default '#6366f1',
  -- 当初工数（プロジェクト単位の初期見積, 時間）。受注の当初工数とは別。
  initial_hours numeric(10, 1) not null default 0,
  -- 予定工数（プロジェクト単位の現時点の予定, 時間）
  planned_hours numeric(10, 1) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists projects_order_idx on public.projects (order_id);
create index if not exists projects_team_idx on public.projects (team_id);

-- マイルストーン（プロジェクトの区間）。日付で区間を指定する（メンバー非依存）。
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists milestones_project_idx on public.milestones (project_id);

-- アサインメント（worker × project の多対多）。
-- worker はここでプロジェクトへ直接アサインされる。プロジェクトの担当チーム(project.team_id)の
-- 「メンバーとして」参加する形だが、worker 自体は team に固定的には属さない。
-- 将来 role / allocation_pct / 期間 などの列を足せる拡張ポイント。
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (worker_id, project_id)
);

create index if not exists assignments_project_idx on public.assignments (project_id);

-- アチーブメント（アサイン × マイルストーンの許容工数）。
-- 「あるメンバー(assignment)がその区間(milestone)でどれだけ働いてよいか」を表す。
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  -- 働いてよい上限工数（時間）
  allowed_hours numeric(8, 1) not null default 0,
  created_at timestamptz not null default now(),
  unique (assignment_id, milestone_id)
);

create index if not exists achievements_assignment_idx on public.achievements (assignment_id);
create index if not exists achievements_milestone_idx on public.achievements (milestone_id);

-- 工数エントリ: あるワーカーが、ある年月に、あるプロジェクトへ投下した時間。
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  hours numeric(6, 1) not null default 0,
  created_at timestamptz not null default now(),
  -- ワーカー×プロジェクト×年月 は一意（upsert 用）
  unique (worker_id, project_id, year, month)
);

create index if not exists entries_year_idx on public.entries (year);
create index if not exists entries_worker_idx on public.entries (worker_id);
create index if not exists entries_project_idx on public.entries (project_id);

-- ========== RLS ==========
-- デモ用途のため anon による読み書きを許可します。
-- 本番でユーザー認証を導入する場合は、auth.uid() ベースのポリシーに置き換えてください。

alter table public.teams enable row level security;
alter table public.workers enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.assignments enable row level security;
alter table public.achievements enable row level security;
alter table public.entries enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['teams', 'workers', 'clients', 'orders', 'projects', 'milestones', 'assignments', 'achievements', 'entries'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_all') then
      execute format('create policy %I on public.%I for all using (true) with check (true)', t || '_all', t);
    end if;
  end loop;
end $$;

-- ========== サンプルデータ（任意） ==========
-- 空のテーブルの場合のみ、動作確認用のサンプルを投入します。

do $$
declare
  t1 uuid; t2 uuid;
  m1 uuid; m2 uuid; m3 uuid; m4 uuid;
  c_a uuid; c_b uuid; c_in uuid;
  o1 uuid; o2 uuid; o3 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  ms1 uuid; ms2 uuid; ms3 uuid; ms4 uuid;
  a_m1p1 uuid; a_m2p1 uuid; a_m2p2 uuid; a_m3p3 uuid; a_m4p3 uuid; a_m3p4 uuid;
  yr integer := 2026;
  mth integer;
begin
  if (select count(*) from public.workers) > 0 then
    return;
  end if;

  -- チーム
  insert into public.teams (name) values ('開発1部') returning id into t1;
  insert into public.teams (name) values ('開発2部') returning id into t2;

  -- ワーカー
  insert into public.workers (name) values ('佐藤 太郎') returning id into m1;
  insert into public.workers (name) values ('鈴木 花子') returning id into m2;
  insert into public.workers (name) values ('高橋 健')   returning id into m3;
  insert into public.workers (name) values ('田中 誠')   returning id into m4;

  -- 顧客
  insert into public.clients (name) values ('社内') returning id into c_in;
  insert into public.clients (name) values ('A社')  returning id into c_a;
  insert into public.clients (name) values ('B社')  returning id into c_b;

  -- 受注（order）。initial_hours=当初工数, planned_hours=予定工数。
  insert into public.orders (client_id, name, fiscal_year, owner_worker_id, initial_hours, planned_hours, budget_amount)
    values (c_in, '社内基盤刷新 受注', yr, m1, 3000, 3200, 30000000) returning id into o1;
  insert into public.orders (client_id, name, fiscal_year, owner_worker_id, initial_hours, planned_hours, budget_amount)
    values (c_a,  'ECサイト構築 受注',  yr, m2, 2400, 2400, 24000000) returning id into o2;
  insert into public.orders (client_id, name, fiscal_year, owner_worker_id, initial_hours, planned_hours, budget_amount)
    values (c_b,  '保守運用 受注',       yr, m3, 1200, 1000, 12000000) returning id into o3;

  -- プロジェクト（受注を細分化。1プロジェクト=1チーム）。
  -- 当初/予定工数はプロジェクト固有で、受注の値や他PJとの和とは独立。
  insert into public.projects (order_id, team_id, name, color, initial_hours, planned_hours)
    values (o1, t1, '社内基盤刷新', '#6366f1', 1500, 1600) returning id into p1;
  insert into public.projects (order_id, team_id, name, color, initial_hours, planned_hours)
    values (o2, t1, 'ECサイト構築', '#10b981', 2000, 2100) returning id into p2;
  insert into public.projects (order_id, team_id, name, color, initial_hours, planned_hours)
    values (o3, t2, '保守運用',     '#f59e0b',  900,  850) returning id into p3;
  insert into public.projects (order_id, team_id, name, color, initial_hours, planned_hours)
    values (o1, t2, 'R&D / 提案',   '#ef4444',  400,  500) returning id into p4;

  -- マイルストーン（各プロジェクトの区間。ここでは 2026通期）
  insert into public.milestones (project_id, name, start_date, end_date)
    values (p1, '2026通期', date '2026-01-01', date '2026-12-31') returning id into ms1;
  insert into public.milestones (project_id, name, start_date, end_date)
    values (p2, '2026通期', date '2026-01-01', date '2026-12-31') returning id into ms2;
  insert into public.milestones (project_id, name, start_date, end_date)
    values (p3, '2026通期', date '2026-01-01', date '2026-12-31') returning id into ms3;
  insert into public.milestones (project_id, name, start_date, end_date)
    values (p4, '2026通期', date '2026-01-01', date '2026-12-31') returning id into ms4;

  -- アサインメント（担当チームの全員ではなく一部）
  --   p1(t1): 佐藤・鈴木   p2(t1): 鈴木のみ（佐藤は不参加）
  --   p3(t2): 高橋・田中   p4(t2): 高橋のみ（田中は不参加）
  insert into public.assignments (worker_id, project_id) values (m1, p1) returning id into a_m1p1;
  insert into public.assignments (worker_id, project_id) values (m2, p1) returning id into a_m2p1;
  insert into public.assignments (worker_id, project_id) values (m2, p2) returning id into a_m2p2;
  insert into public.assignments (worker_id, project_id) values (m3, p3) returning id into a_m3p3;
  insert into public.assignments (worker_id, project_id) values (m4, p3) returning id into a_m4p3;
  insert into public.assignments (worker_id, project_id) values (m3, p4) returning id into a_m3p4;

  -- アチーブメント（アサイン×区間で「働いてよい上限工数」）
  insert into public.achievements (assignment_id, milestone_id, allowed_hours) values
    (a_m1p1, ms1, 900),
    (a_m2p1, ms1, 540),
    (a_m2p2, ms2, 1140),
    (a_m3p3, ms3, 780),
    (a_m4p3, ms3, 1020),
    (a_m3p4, ms4, 300);

  -- 工数（参加者のみ）
  for mth in 1..12 loop
    insert into public.entries (worker_id, project_id, year, month, hours) values
      (m1, p1, yr, mth, 70), (m2, p1, yr, mth, 40),   -- 社内基盤刷新
      (m2, p2, yr, mth, 90),                           -- ECサイト構築
      (m3, p3, yr, mth, 60), (m4, p3, yr, mth, 80),   -- 保守運用
      (m3, p4, yr, mth, 20);                           -- R&D / 提案
  end loop;
end $$;
