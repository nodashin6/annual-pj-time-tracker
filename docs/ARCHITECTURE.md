# アーキテクチャ

年間稼働トラッカーの構成と設計方針をまとめます。

設計判断の根拠は [`docs/superpowers/specs/2026-08-19-pj-recursive-data-model-design.md`](specs/2026-08-19-pj-recursive-data-model-design.md) を参照してください。

## レイヤ構成

```
UI (app/**, components/**)              ← React / Next.js App Router
  └─ 状態 (lib/store/)                  ← Zustand ストア（唯一の可変状態）
       ├─ index.ts                      ← ストア合成 + load()（初期ロード）
       ├─ core.ts                       ← pj / tracker / issue / task の CRUD スライス
       ├─ actuals.ts                    ← task_entries（実績）の CRUD スライス
       ├─ mappers.ts                    ← DB行 ⇄ アプリ内型の変換
       ├─ 検証 (lib/schemas.ts)         ← Zod。書き込み前に入力を検証
       ├─ 通知 (lib/notify.ts)          ← トースト（成功/失敗）
       ├─ 集計 (lib/aggregate/)         ← 純関数。テスト対象
       │    ├─ tree.ts                  ← コア層。pj ツリーの走査（親子・祖先・葉・契約判定）
       │    ├─ plan.ts                  ← コア層。task の期間から予定工数を導出
       │    └─ progress.ts              ← 実績拡張層。task_entries を集計（コア層に一方向依存）
       └─ 永続化 (lib/supabase.ts)      ← Supabase(PostgreSQL) クライアント
            └─ 環境検証 (lib/env.ts)    ← 起動時に接続情報を Zod 検証
```

### 依存の向き

- UI は `store` にのみ依存し、Supabase を直接触らない。
- `store` の各書き込みアクションは **`schemas.ts` で検証 → Supabase 反映 → 楽観的更新**の順で処理する。
- `aggregate/` は入力（配列）から出力（集計値）だけを計算する純関数群で、副作用を持たない。これによりユニットテストが容易。
- `aggregate/` 内部にも依存の向きがある: `tree.ts` / `plan.ts`（コア層）は `progress.ts`（実績拡張層）を import しない。逆方向のみ許可される。この向きは `aggregate/layering.test.ts` が固定している。

## データモデル

```
pj (再帰ツリー)
 ├─ pj_members ── workers
 └─ tracker           ← 行の存在 = この pj は葉
      ├─ issues       ← 階層あり・期日・担当は任意
      └─ tasks        ← 階層なし・時刻付き期間・担当1名必須
           └─ task_entries   ← 実績拡張層（year × month × hours）
```

- **pj** は自己参照の再帰ツリー（`parent_id`）。顧客・受注・プロジェクト・サブタスクといった旧モデルの階層は、すべてこの1つの木に統合されている。
- **契約（受注）ノード**は `fiscal_year` / `budget_amount` のいずれかを持つ pj。この判定は `isContractNode()`（`aggregate/tree.ts`）に閉じ込められており、UI や他の集計関数から `pj.fiscalYear != null` を直接書くことは禁止（判定ロジックの単一の真実の源）。
- **葉**は tracker 行の存在で決まる（宣言フラグではない）。葉だけが issue・task を持てる。
- **pj_members** は pj への直接所属。`effectiveMembers()` は自ノード + 全祖先の和集合を返し、task の担当者候補をここから絞る。
- **task** は Google Calendar のイベント相当（時刻付き開始・終了、担当1名必須）。**予定工数は保存しない**。`plannedHoursOf()`（`aggregate/plan.ts`）が task の期間（endAt - startAt）から導出する。
- **task_entries** は実績の記録層で、task × year × month で一意（upsert 対象）。task の期間が年をまたぐ場合でも、実績は実測で年ごとに分けて持てる。

### 不変条件: コア層は実績ゼロ件で完結する

`tree.ts` と `plan.ts`（コア層）は `task_entries` の存在を一切前提にしない。pj ツリーの走査、葉/契約判定、メンバー解決、予定工数の算出は、実績の行が1件も無くても完全に動作する。実績（`task_entries`）は `progress.ts` が一方向に依存する拡張層であり、コア層からは見えない。この分離により「予定だけ入れて実績は後で埋める」運用や、実績を伴わないツリー編集画面が成立する。

詳細は [`supabase/schema.sql`](../supabase/schema.sql) を参照。

## 状態管理の方針

- **楽観的更新**: `updateXxx` / `setTaskHours` は先にローカル状態を更新し、失敗時に `prev` へロールバックしてトーストで通知する。
- **エラーハンドリング**: すべての DB 例外は `fail()` に集約し、ストアの `error` 状態とトーストの両方へ反映する。
- **検証の単一の真実の源**: 入力制約は `schemas.ts` に集約。UI 表示型（`types.ts`）とは分離する。

## 品質・CI

- **型**: TypeScript strict。`npm run typecheck`。`any` は ESLint（`no-explicit-any`）で禁止。
- **Lint/Format**: ESLint(flat config) + Prettier。
- **テスト**: Vitest。純関数（aggregate/tree・aggregate/plan・aggregate/progress・schemas・store/mappers・ui・env）と層の依存方向（aggregate/layering）を対象に境界値を網羅。
- **CI**: `.github/workflows/ci.yml` で format:check → lint → typecheck → test → build を実行。
- **ブランチ保護**: `.githooks/pre-push` が `main` への直 push をブロック（PR 経由を強制）。

## セキュリティ

- 環境変数は `env.ts` で Zod 検証し、形式不正を UI で早期提示する。
- RLS はデモ用に anon 全許可。認証導入時は [`supabase/policies-authenticated.sql`](../supabase/policies-authenticated.sql) で「認証済みのみ」に切り替える。
- 匿名公開鍵（anon key）はクライアントに露出する前提の公開値。**サービスロールキーはコミットしない**。

## 拡張ポイント

- **サブツリー集計の高速化**: 現状 `descendantIds()` はアプリ側でツリーを辿って計算する。pj に `path text`（例: `ltree` 相当の materialized path）を持たせれば、SQL 側で `WHERE path <@ '...'` のようなサブツリー集計に差し替えられる。
- **予定工数のロジック差し替え**: `plannedHoursOf()`（`aggregate/plan.ts`）は現状「枠の長さそのもの」を予定工数としているが、営業時間換算（1日8時間・平日のみ）にしたくなった場合、差し替えるのはこの関数1本で済む。
- **issue の複数担当**: 現状 issue の担当は任意の1名（もしくは無し）想定だが、task と同様に担当を持たせる/複数名に広げるのは pj_members ベースの候補解決（`effectiveMembers()`）と独立して拡張できる。
- マルチテナント化: 各テーブルに org_id を持たせ `auth.uid()` ベースの RLS へ拡張。
