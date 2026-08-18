# pj 再帰データモデルへの全面改修 — 設計書

対象: annual-pj-time-tracker
日付: 2026-08-19
前提メモ: [`docs/data-model-redesign.md`](../../data-model-redesign.md)（ドラフト。本書がその未決事項をすべて確定させる）

---

## 1. 目的

現行の `clients ─1:N─ orders ─1:N─ projects` という3層固定構造を、**再帰ツリー1本 + 作業アイテム層**に置き換える。あわせて `teams` / `milestones` / `assignments` / `achievements` の4概念を吸収し、テーブル数を 9 → 6 に減らす。

改修の中心は構造だけではない。**工数管理をコア層から切り離し、task に依存する拡張層に降格させる**。これにより「稼働可能工数を先に決めないとタスクが作れない」という現行モデルの逆立ちした依存を解消する。

---

## 2. 層構造

```
┌─ コア層 ─────────────────────────────────┐
│  pj (再帰ツリー)                          │
│   ├─ pj_members                           │
│   └─ tracker  ← 行の存在 = この pj は葉    │
│        ├─ issues  (階層あり・期日・担当は任意) │
│        └─ tasks   (階層なし・時刻付き期間・担当必須) │
└──────────────────────────────────────────┘
                    ▲ 一方向参照
┌─ 実績拡張層 ─────────────────────────────┐
│  task_entries (task × 年月 × 時間)         │
└──────────────────────────────────────────┘
```

**不変条件: コア層は工数の行が1件もない状態で完結して使える。** 実績拡張層を丸ごと削除してもコア層は動作する。逆はできない。

### 比喩

- **task = Google Calendar のイベント**。担当者が必ず1人いて、時刻付きの枠を持つ。枠の長さがそのまま予定工数。
- **issue = GitHub の issue**。担当者は宙ぶらりんでもよいが、必ずどこかのリポジトリ（= 葉pj）に属する。

粗い単位は issue、カレンダーに置く具体ブロックが task。「締切だけ決まっている issue を、誰がいつやるかの task に分解する」は `tasks.issue_id` で表現する。

---

## 3. 決定事項

前提メモの未決事項に対する結論。

| 論点 | 結論 | 理由 |
|---|---|---|
| **b. tracker は1個か複数か** | `mode` 列を廃止し、tracker は葉pjに1個固定（`pj_id` を主キー） | 「ガントで見るかバックログで見るか」は表示の話であって DB 制約ではない。mode を構造にした結果が b という問いだった。廃止すれば tasks と issues が同じ tracker に共存でき、b-2 が欲しがった分解も `tasks.issue_id` で表現できる |
| **a. 実績の紐づけ先** | `task_entries.task_id` | 工数が task 依存の拡張層になったため |
| **c. 予定工数** | task の `end_at - start_at` から導出。手入力を廃止 | カレンダーの枠は長さを持つ。手入力と併存させると二重管理になる |
| 稼働可能工数（旧 `achievements`） | **廃止** | タスク作成の前提として上限工数を要求する形になり、依存が逆立ちする |
| 受注（契約単位）の識別 | `fiscal_year` / `budget_amount` の有無で判定 | 列を増やさない。散らばり防止は §5-3 の述語1本への封じ込めで担保する |
| issue の担当者 | 任意1人（nullable） | GitHub issue と同じく宙ぶらりんを許す |
| issue の親子 | 同一 tracker 内に限定（トリガ） | 前提メモの推奨どおり |
| task の担当者 | 必須1名。`task_assignees` への分離はしない | カレンダーなら2人の作業は2件のイベントであって、1件に2人ではない |
| member の継承 | 有効メンバー = 自ノード + 全祖先の和集合 | 前提メモの推奨どおり。ただし DB トリガにはしない（§5-3） |
| `milestones` | tracker の `start_date` / `end_date` に吸収して廃止 | 現行 UI に書き込み口が存在せず、実質未使用 |
| `path ltree` | **不採用** | §4-3 |
| 既存データ | 移行しない。drop & recreate | サンプルデータのみで保全対象なし |

---

## 4. スキーマ

### 4-1. コア層

```sql
create table pj (                       -- 旧 clients + orders + projects
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references pj(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  owner_worker_id uuid references workers(id) on delete set null,
  fiscal_year integer,                  -- 入っているノード = 契約単位
  budget_amount numeric(14,2),          -- 同上（金額であって工数ではない）
  created_at timestamptz not null default now()
);

create table pj_members (               -- 旧 assignments + teams
  pj_id uuid not null references pj(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  primary key (pj_id, worker_id)
);

create table tracker (                  -- 葉の印 + 期間。旧 milestones の吸収先
  pj_id uuid primary key references pj(id) on delete cascade,
  start_date date,
  end_date date,
  check (start_date is null or end_date is null or start_date <= end_date)
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  tracker_pj_id uuid not null references tracker(pj_id) on delete cascade,
  parent_id uuid references issues(id) on delete cascade,
  assignee_id uuid references workers(id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  tracker_pj_id uuid not null references tracker(pj_id) on delete cascade,
  issue_id uuid references issues(id) on delete set null,
  assignee_id uuid not null references workers(id) on delete restrict,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  check (start_at < end_at),
  created_at timestamptz not null default now()
);
```

`workers` は現行のまま存続。

### 4-2. 実績拡張層

```sql
create table task_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  hours numeric(6,1) not null default 0,
  unique (task_id, year, month)
);
```

年月を残すのは、月をまたぐ task の実績を按分せず実測で分けられるようにするため。1日に収まる task なら行は1件だけになる。担当者は `task.assignee_id` から引くので `worker_id` は持たない。

**代償（承知のうえで受け入れる）**: task の担当者を差し替えると、その task の過去月の実績も新担当者の集計に移る。

### 4-3. `path ltree` を採用しない理由

1. ltree のラベルは英数字と `_` のみで、**UUID のハイフンが入らない**。uuid を加工して詰める必要が出て可読性と参照整合性が落ちる
2. サブツリー集計は全件を Zustand にロード済みのフロント（`aggregate/`）で回っており、SQL 側の高速サブツリー検索を使う口が現時点でない
3. 残る唯一の用途である循環防止は再帰CTEトリガ1本で足り、`path` 維持トリガ（親変更時のサブツリー再計算）を丸ごと削除できる

ノード数が増えて SQL 側集計が必要になった時点で `path text` を足すほうが安い。

### 4-4. トリガ（3本）

| 名前 | 内容 |
|---|---|
| `pj_no_cycle` | `parent_id` 変更時に祖先を再帰CTEで辿り、自分が現れたら reject |
| `pj_leaf_consistency` | 双方向チェック。tracker 挿入時「その pj に子がいたら reject」／pj の親設定時「親が tracker 持ちなら reject」 |
| `issue_same_tracker` | issue の親子が tracker をまたぐのを reject |

### 4-5. 廃止するテーブル（8）

`teams` `clients` `orders` `projects` `milestones` `assignments` `achievements` `entries`

### 4-6. RLS

現行と同じ方針を維持する。`supabase/schema.sql` の anon 全許可ポリシーと `supabase/policies-authenticated.sql` の認証済み限定ポリシーを、新テーブル名（`pj` `pj_members` `tracker` `issues` `tasks` `task_entries` `workers`）に合わせて更新するのみ。

---

## 5. TypeScript 層

### 5-1. ディレクトリ構成

層の境界をファイル構造に出し、「拡張層を落としてもコアが動く」を機械的に検証できる状態にする。

```
src/lib/
  types.ts              Worker, Pj, Tracker, Issue, Task | TaskEntry
  schemas.ts            Zod
  supabase.ts           Db* 型の差し替えのみ
  store/
    crud.ts             検証 → 楽観的更新 → ロールバック の共通ヘルパ
    core.ts             pj / pjMembers / tracker / issues / tasks スライス
    actuals.ts          taskEntries スライス
    index.ts            スライス合成 + load / year / status / error
  aggregate/
    tree.ts             ツリー構築・葉判定・祖先/子孫・有効メンバー・契約ノード判定
    plan.ts             予定工数の導出
    progress.ts         消化率・月次積み上げ・worker別（実績層）
```

**`aggregate/tree.ts` と `aggregate/plan.ts` は `TaskEntry` を import しない。** これをテストで固定する。

現行の [`src/lib/store.ts`](../../../src/lib/store.ts) は655行に9テーブル分の CRUD が平置きで、`add` / `update` / `remove` の「検証 → 楽観的更新 → 失敗ならロールバック」がテーブルごとに手書き複製されている。新モデルでは全テーブルが差し替わるためどのみち全面書き直しになるので、`crud.ts` に共通ヘルパを1本置き、各スライスは「テーブル名・変換関数・スキーマ」を渡すだけにする。おおよそ 655 → 300 行。

### 5-2. 型

```ts
// --- コア層 ---
export type Worker = { id: string; name: string };

export type Pj = {
  id: string;
  parentId?: string;
  name: string;
  color: string;
  ownerWorkerId?: string;
  fiscalYear?: number;
  budgetAmount?: number;
};

export type PjMember = { pjId: string; workerId: string };

/** 葉の印 + 期間。行が存在する pj が葉。 */
export type Tracker = { pjId: string; startDate?: string; endDate?: string };

export type Issue = {
  id: string;
  trackerPjId: string;
  parentId?: string;
  assigneeId?: string;
  title: string;
  dueDate?: string;
  status: string;
};

export type Task = {
  id: string;
  trackerPjId: string;
  issueId?: string;
  assigneeId: string;
  title: string;
  startAt: string; // ISO8601
  endAt: string;
};

// --- 実績拡張層 ---
export type TaskEntry = {
  id: string;
  taskId: string;
  year: number;
  month: number;
  hours: number;
};
```

### 5-3. 規則を関数1本ずつに封じ込める

前提メモが「暗黙ルールがコードに散らばる」と警戒していた箇所を、UI から直接書けない形にする。

```ts
// aggregate/tree.ts
/** 契約（受注）ノードか。この判定規則が存在してよいのはここだけ。 */
export const isContractNode = (pj: Pj) =>
  pj.fiscalYear != null || pj.budgetAmount != null;

/** 葉か。tracker 行の存在がすべて。 */
export const isLeaf = (pjId: string, trackers: Tracker[]) =>
  trackers.some((t) => t.pjId === pjId);

/** 有効メンバー = 自ノード + 全祖先の和集合。 */
export const effectiveMembers = (
  pjId: string, pjs: Pj[], members: PjMember[]
): string[] => { /* ... */ };
```

```ts
// aggregate/plan.ts
/** task の予定工数。カレンダーの枠の長さ。営業時間換算にするならここだけ差し替える。 */
export const plannedHoursOf = (t: Task) =>
  (Date.parse(t.endAt) - Date.parse(t.startAt)) / 3_600_000;
```

**`task.assignee` が所属葉pjの有効メンバーであることは DB トリガにしない。** `effectiveMembers()` による担当者ドロップダウンの絞り込みと Zod での検証で担保する。トリガにすると、メンバーを外した瞬間に既存 task が更新不能になる。

### 5-4. 集計関数の対応

| 現行 | 新 | 変更点 |
|---|---|---|
| `monthlyStackByProject` | `monthlyStackByLeaf` | task 経由で葉pjへ寄せて積み上げ |
| `annualByProject` | `annualByLeaf` | 同上 |
| `workerHours` | `workerHours` | `task.assigneeId` 経由 |
| `orderProgress` | `contractProgress` | `isContractNode` で抽出。サブツリー配下 task の `plannedHoursOf` 合計 vs `task_entries` 合計 |
| `orgTotals` | `orgTotals` | 予定の出所が受注手入力から task 積み上げへ |
| `filterByYear` / `availableYears` | 据え置き | 年は `task_entries` と `tasks.startAt` の和集合から |

---

## 6. 画面構成

| 現行 | 新 | 備考 |
|---|---|---|
| `/` | `/` | 受注別 → 契約ノード別。予定の出所が変わる |
| `/clients` `/clients/new` `/clients/[id]`<br>`/orders` `/orders/new` `/orders/[id]`<br>`/projects` `/projects/new` `/projects/[id]` | `/pj`<br>`/pj/[id]` | 同じものの階層違いなのでツリー1画面に統合。削除9・新設2 |
| — | `/pj/[id]/issues` | 新設。階層バックログ（担当者・期日・status） |
| — | `/pj/[id]/calendar` | 新設。task のカレンダー |
| `/worker-entries`<br>`/worker-entries/[worker_id]` | `/actuals`<br>`/actuals/[worker_id]` | 作り替え（§6-1） |
| `/master` | `/master` | teams を落として workers のみ |

`components/Charts.tsx` は `projects` → 葉pj への差し替えのみ。`components/Sidebar.tsx` のリンクは 6 → 5 本。

`/pj/[id]` は中間ノードと葉の両方を1つの画面で扱う。共通部（名称・色・担当・`fiscal_year` / `budget_amount`・メンバー）に加え、**子pjが1件もないノードにだけ「tracker を付ける」操作を出し、tracker を持つノードにだけ issues / calendar へのリンクを出す**。どちらの操作を出すかは `isLeaf()` と子の有無から導出し、画面側で状態を宣言しない（トリガ `pj_leaf_consistency` が最終防衛線）。

### 6-1. 実績入力画面の作り替え

現行は「worker × プロジェクト × 12ヶ月」の固定グリッド。実績が task 単位になると1人あたり年間で数十行に膨らみ、12列グリッドが破綻する。2階層にする。

- **親行 = 葉pj** — 読み取り専用の月次合計。年間ビューが保たれる
- **子行 = task**（親行を展開して表示）— 入力可
- task の期間と重なる月をハイライトする。ズレた月への入力自体は許可する（予定と実績はズレるもの）

---

## 7. 移行方式

保全すべき実データがないため、移行 SQL は書かない。

- `supabase/schema.sql` を新モデルで全面書き直し。冒頭に旧8テーブルの `drop table if exists ... cascade` を置く
- `supabase/policies-authenticated.sql` のテーブル名を更新
- サンプルデータ投入ブロックを新モデルで書き直す。**pj の階層が2段だけにならないよう、3段以上のツリーを1本含める**（再帰構造が実際に効いていることを目視できるようにするため）

---

## 8. テスト方針

Vitest。現行の [`src/lib/aggregate.test.ts`](../../../src/lib/aggregate.test.ts)（196行）は全面書き換え。

- **ツリー**: 循環検出、深さ3以上でのサブツリー集計、親のない孤立ノード
- **葉判定**: tracker の有無、子を持つ pj に tracker を付けようとした場合
- **有効メンバー**: 祖先からの継承、重複の排除
- **予定工数の導出**: 日をまたぐ task、分単位の端数
- **契約ノード判定**: `fiscal_year` のみ / `budget_amount` のみ / 両方 / どちらもない
- **依存方向**: `aggregate/tree.ts` `aggregate/plan.ts` が実績層を import していないこと
- **スキーマ**: `schemas.test.ts` を新スキーマで書き直し

---

## 9. 非スコープ

- 認証・マルチテナント（RLS は現行方針を維持）
- `path ltree` および SQL 側でのサブツリー集計
- 予定工数の営業時間換算（`plannedHoursOf` の差し替えで後から可能）
- task の複数担当（カレンダー比喩により不要と判断）
- 既存データの移行

---

## 10. 承知のうえで受け入れる代償

1. **受注単位の予定工数を手入力できなくなる。** 消化率は配下 task の積み上げになるため、task を1件も作っていない受注の予定は 0 になる。粗い見積もりを置きたい場合は issue で表現する。
2. **予定工数 = 枠の長さ**なので、複数日にまたがる task は夜間・休日も数えてしまう。task は1日内に収める運用を前提とする。粗い単位は issue の責務。
3. **task の担当者を差し替えると過去月の実績も移る**（§4-2）。
