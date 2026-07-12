# 年間稼働トラッカー (annual-pj-time-tracker)

顧客・受注・プロジェクト単位で**工数**を月次／年次に集計・可視化する稼働管理アプリです。

「どの受注にどれだけ工数が投下され、予定に対してどれだけ消化したか」「誰がどのプロジェクトに入っているか」を素早く把握することを目的としています。

## 主な機能

- **ダッシュボード** — 受注別の工数（当初 / 予定 / 実績 / 消化率）とワーカー別投下工数を集計
- **グラフ可視化** — 月次工数の積み上げ棒グラフ（プロジェクト別）、年間構成比の円グラフ
- **マスタ管理** — 顧客 / 受注 / プロジェクト / ワーカー / チームの CRUD
- **工数入力** — ワーカー別ルートで、割り当てられたプロジェクトの 12 か月分を入力
- **年切り替え** — 複数年のデータを保持し、対象年を切り替えて表示

## 技術スタック

- [Next.js 15](https://nextjs.org/)（App Router） + TypeScript（strict）
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) によるグラフ描画
- [Zustand](https://github.com/pmndrs/zustand) でクライアント状態を管理
- [Zod](https://zod.dev/) による入力・環境変数の検証
- **バックエンド: [Supabase](https://supabase.com/)（PostgreSQL）**
- テスト: [Vitest](https://vitest.dev/) / Lint: ESLint 9 / Format: Prettier

## セットアップ

### 1. Supabase を用意

1. [Supabase](https://supabase.com/) でプロジェクトを作成。
2. **SQL Editor** で [`supabase/schema.sql`](supabase/schema.sql) を実行（テーブル作成＋サンプル投入）。
3. **Project Settings > API** から `Project URL` と `anon public` キーを取得。

### 2. 環境変数

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

環境変数の形式が不正な場合は起動時に UI で通知されます。未設定の場合は設定手順が表示されます（デモモード）。

### 3. 起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開きます。

## 開発コマンド

| コマンド                  | 内容                                         |
| ------------------------- | -------------------------------------------- |
| `npm run dev`             | 開発サーバー                                 |
| `npm run build` / `start` | 本番ビルド / 起動                            |
| `npm run lint`            | ESLint                                       |
| `npm run format`          | Prettier で整形（`format:check` で検査のみ） |
| `npm run typecheck`       | 型チェック（`tsc --noEmit`）                 |
| `npm run test`            | Vitest（`test:watch` / `test:coverage`）     |
| `npm run verify`          | typecheck + lint + test を一括実行           |

## データモデル

```
clients ─1:N─ orders ─1:N─ projects ─(N:1)─ teams
                               ├─1:N─ milestones
                               └─N:M─ workers  (assignments)
entries: worker × project × 年月（4項目で一意）
```

- **client（顧客）** が **order（受注）** を出し、受注は複数の **project** に細分化される。
- 各 project は1つの **team** が担当し、**worker** は `assignments` で project へアサインされる。
- **entry（工数）** は worker × project × 年月で記録し、月次/年次に集計する。

詳細な設計は [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) を参照してください。

## セキュリティ / RLS

- RLS はデモ用に anon の読み書きを許可しています。
- 認証を導入する場合は [`supabase/policies-authenticated.sql`](supabase/policies-authenticated.sql) を実行し、「認証済みユーザーのみ」に切り替えてください。
- サービスロールキーはコミットしないでください（anon key はクライアント露出前提の公開値）。

## CI / 品質

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml): format:check → lint → typecheck → test → build を PR/push で実行。
- [`.githooks/pre-push`](.githooks/pre-push): `main` への直 push をブロック（PR 経由を強制）。有効化は `git config core.hooksPath .githooks`。

## ライセンス

MIT
