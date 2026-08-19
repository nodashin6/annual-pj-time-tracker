# データモデル改修方針メモ

対象: [annual-pj-time-tracker](https://github.com/nodashin/annual-pj-time-tracker)
状態: **ドラフト（未決事項あり）**

---

## 1. 背景

現行スキーマは `clients ─1:N─ orders ─1:N─ projects` の **3層固定**構造。

- 顧客が階層を持つ、受注をさらに束ねる、といった要求で即座に破綻する
- `teams` / `milestones` / `assignments` / `achievements` と概念が多く、認知負荷が高い

これを **再帰構造1本 + 作業アイテム層** の2層に単純化する。

---

## 2. 新モデルの骨子

```
pj (再帰ツリー)
 ├─ pj (中間ノード): 子pjを持つ / memberをassign
 └─ pj (葉): tracker が attach されている
      └─ tracker (時間管理オブジェクト)
           ├─ mode='task'  → tasks   (階層なし・開始終了・担当者1名必須)
           └─ mode='issue' → issues  (階層あり・期日のみ)
```

### 確定した設計判断

| #   | 判断            | 内容                                                                                                               |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | pj の再帰化     | `clients` / `orders` / `projects` の3テーブルを `pj` 1本に統合。親子関係を自己参照で表現                           |
| 2   | member の割当先 | pj に対して assign する                                                                                            |
| 3   | 葉pj の判定方法 | `kind` 列などの**派生・宣言フラグを使わない**。時間管理オブジェクト (`tracker`) が attach されているものを葉とする |
| 4   | 葉pj の2形態    | `tracker.mode` が `task` か `issue` かで決まる                                                                     |
| 5   | issue           | 単一の葉pjに属する / 期日を持つ / 階層構造を持つ                                                                   |
| 6   | task            | 階層を持たない / 開始・終了を持つ / 担当者1名必須                                                                  |

### なぜ tracker を attach する形にしたか

- 葉かどうかが「**行の存在**」という肯定的な事実になる（「子がいないこと」の否定形を証明しなくてよい）
- task型 / issue型の差異が列の値ではなく実体になるため、型ごとの属性を nullable 列に相乗りさせずに済む
- 既存の `milestones`（区間）と `achievements`（アサイン×区間の許容工数）を tracker 側に自然に吸収できる

---

## 3. スキーマ案

```sql
-- ========== pj 層 ==========
create table pj (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references pj(id) on delete cascade,
  path ltree not null,              -- 循環防止・パンくず・サブツリー集計用
  name text not null,
  color text not null default '#6366f1',
  fiscal_year integer,              -- 旧 orders 由来（受注ノードのみ利用）
  budget_amount numeric(14,2)       -- 同上
);

create table pj_members (
  pj_id uuid not null references pj(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  primary key (pj_id, worker_id)
);

-- ========== 時間管理オブジェクト ==========
create table tracker (
  id uuid primary key default gen_random_uuid(),
  pj_id uuid not null unique references pj(id) on delete cascade,
  mode text not null check (mode in ('task','issue')),
  start_date date,                  -- task型: 活動期間の開始
  end_date date,                    -- issue型: 締切として利用
  initial_hours numeric(10,1) not null default 0,
  planned_hours numeric(10,1) not null default 0,
  unique (id, mode)                 -- 下の複合FK用
);

-- ========== 作業アイテム層 ==========
create table tasks (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  tracker_mode text not null default 'task' check (tracker_mode = 'task'),
  assignee_id uuid not null references workers(id) on delete restrict,
  title text not null,
  start_at date not null,
  end_at date not null,
  check (start_at <= end_at),
  foreign key (tracker_id, tracker_mode) references tracker(id, mode)
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  tracker_mode text not null default 'issue' check (tracker_mode = 'issue'),
  parent_id uuid references issues(id) on delete cascade,
  path ltree not null,
  title text not null,
  due_date date,
  status text not null default 'open',
  foreign key (tracker_id, tracker_mode) references tracker(id, mode)
);

-- 旧 achievements の移行先
create table tracker_allocations (
  tracker_id uuid not null references tracker(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  allowed_hours numeric(8,1) not null default 0,
  primary key (tracker_id, worker_id)
);
```

### 複合FKの意図

`tracker(id, mode)` に UNIQUE を張り、`tasks` / `issues` 側で `tracker_mode` を定数に固定した複合FKを張ることで、
**「issue型の tracker に task が刺さる」事故をDB制約だけで防ぐ**。トリガを1本削減できる。

### 残るトリガ

- **tracker を持つ pj は子を持てない / 子を持つ pj には tracker を attach できない**（双方向チェック）
- `path` の維持（親変更時のサブツリー再計算）

---

## 4. 未決事項

議論の結論待ち。**b が決まれば a と c は流れで決まる**。

### b. tracker は葉pjに1個固定か、複数attach可か（最優先）

| 選択肢      | 制約                   | 得られるもの                                                       | 代償                                                                                  |
| ----------- | ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1個固定     | `unique (pj_id)`       | モデルもUIも単純。pjの見え方が「ガント or バックログ」の二択で済む | 「締切だけ決まっている issue をカレンダー上の task に分解する」が構造的に表現できない |
| mode毎に1個 | `unique (pj_id, mode)` | 同一葉pjに task型/issue型を併存でき、issue → task の分解が可能     | 両方持つpjのUI設計が必要。`tasks.issue_id` を足すかの判断が派生する                   |

実運用で「この issue、誰がいつやるの？」は必ず出るため、**今決めておく**。

### a. `entries`（実績工数）の紐づけ先

| 選択肢               | 長所                                                | 短所                                                     |
| -------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| `entries.tracker_id` | 予定と実績が同じ粒度に揃う                          | mode 変更で tracker を作り直すと実績まで巻き添えで消える |
| `entries.pj_id`      | mode 変更に対して実績が安全。tracker は予定側に専念 | 予定と実績の参照先がずれる                               |

集計クエリはどちらでも同形。**mode 変更の頻度**で判断する。頻繁なら pj 側。

### c. `tracker.planned_hours` は手入力か自動算出か

- **手入力**（既存踏襲）: 粗い管理をしたい上位pjでも予定が置ける。既存の消化率ロジックがそのまま生きる
- **自動算出**（配下 task の期間×担当者から積み上げ）: 予定を触るのに task を全部作る必要があり、粗い管理で破綻する

推奨: **手入力を残し、積み上げ値は参考表示**。

### その他

- **issue の親子が pj をまたげるか** → 同一 tracker 内に限定する制約を推奨
- **issue の担当者** → 0人 / 任意1人 / 複数 のいずれか（未定義のまま）
- **task の担当者「必須1名」** → 将来のペア作業・引き継ぎを考えると `task_assignees` に分離して「1件以上」制約にするほうが緩めやすい
- **member の継承** → 「有効メンバー = 自ノード + 全祖先の和集合」を推奨。`task.assignee` は所属葉pjの有効メンバーに含まれることを制約に
- **`milestones` の扱い** → tracker の start/end に吸収して廃止。1つの葉pjを複数区間に切りたい場合は tracker 複数attach（b と連動）か `tracker_periods` を残す

---

## 5. 移行時の注意

- `orders` の `fiscal_year` / `budget_amount` / `initial_hours` / `owner_worker_id` / `client_id` は pj の nullable 列へ。ただし「予算は受注ノードにのみ入る」という暗黙ルールがコードに散らばらないよう、`is_contract_root boolean` 相当のタグを残す価値がある（ダッシュボードの受注別消化率がここに依存）
- `teams` は pj_members に統合して廃止できる見込み
- `pj` / `issues` 両方に自己参照が入るため、循環参照の防止は必須。`path ltree` + 再帰CTEチェックトリガ、または materialized path
