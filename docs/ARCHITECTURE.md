# アーキテクチャ

年間稼働トラッカーの構成と設計方針をまとめます。

## レイヤ構成

```
UI (app/**, components/**)          ← React / Next.js App Router
  └─ 状態 (lib/store.ts)            ← Zustand ストア（唯一の可変状態）
       ├─ 検証 (lib/schemas.ts)     ← Zod。書き込み前に入力を検証
       ├─ 通知 (lib/notify.ts)      ← トースト（成功/失敗）
       ├─ 集計 (lib/aggregate.ts)   ← 純関数。テスト対象
       └─ 永続化 (lib/supabase.ts)  ← Supabase(PostgreSQL) クライアント
            └─ 環境検証 (lib/env.ts) ← 起動時に接続情報を Zod 検証
```

### 依存の向き

- UI は `store` にのみ依存し、Supabase を直接触らない。
- `store` の各書き込みアクションは **`schemas.ts` で検証 → Supabase 反映 → 楽観的更新**の順で処理する。
- `aggregate.ts` は入力（配列）から出力（集計値）だけを計算する純関数群で、副作用を持たない。これによりユニットテストが容易。

## データモデル

```
clients ─1:N─ orders ─1:N─ projects ─(N:1)─ teams
                               │
                               ├─1:N─ milestones
                               └─N:M─ workers  (assignments)
                                        │
assignments × milestones ─ achievements（許容工数）
entries: worker × project × 年月（この4項目で一意, upsert 対象）
```

- **client（顧客）** が **order（受注）** を出し、1つの受注は複数の **project** に細分化される。
- 各 project は1つの **team** が担当し、**worker** は `assignments` で project へ直接アサインされる。
- **entry（工数）** は worker × project × 年月で記録し、ダッシュボードで月次/年次に集計する。

詳細は [`supabase/schema.sql`](../supabase/schema.sql) を参照。

## 状態管理の方針

- **楽観的更新**: `updateXxx` / `setHours` は先にローカル状態を更新し、失敗時に `prev` へロールバックしてトーストで通知する。
- **エラーハンドリング**: すべての DB 例外は `fail()` に集約し、ストアの `error` 状態とトーストの両方へ反映する。
- **検証の単一の真実の源**: 入力制約は `schemas.ts` に集約。UI 表示型（`types.ts`）とは分離する。

## 品質・CI

- **型**: TypeScript strict。`npm run typecheck`。
- **Lint/Format**: ESLint(flat config) + Prettier。`no-explicit-any` などで厳格化。
- **テスト**: Vitest。純関数（aggregate / schemas / ui / env）を対象に境界値を網羅。
- **CI**: `.github/workflows/ci.yml` で format:check → lint → typecheck → test → build を実行。
- **ブランチ保護**: `.githooks/pre-push` が `main` への直 push をブロック（PR 経由を強制）。

## セキュリティ

- 環境変数は `env.ts` で Zod 検証し、形式不正を UI で早期提示する。
- RLS はデモ用に anon 全許可。認証導入時は [`supabase/policies-authenticated.sql`](../supabase/policies-authenticated.sql) で「認証済みのみ」に切り替える。
- 匿名公開鍵（anon key）はクライアントに露出する前提の公開値。**サービスロールキーはコミットしない**。

## 拡張ポイント

- `assignments` に role / allocation_pct / 期間を追加してアサインを詳細化。
- `achievements`（アサイン×マイルストーンの許容工数）を用いた予実対比・アラート。
- マルチテナント化: 各テーブルに org_id を持たせ `auth.uid()` ベースの RLS へ拡張。
