# 年間稼働トラッカー (annual-pj-time-tracker)

プロジェクトを再帰ツリー（`pj`）で管理し、その葉に紐づく **task の実績工数**を月次／年次に集計・可視化する稼働管理アプリです。

「どの契約ノード（受注）にどれだけ工数が投下され、予定に対してどれだけ消化したか」「誰がどの task を担当しているか」を素早く把握することを目的としています。

## 主な機能

- **ダッシュボード** — 契約ノード別の工数（予定 / 実績 / 消化率）とワーカー別投下工数を集計
- **グラフ可視化** — 月次工数の積み上げ棒グラフ（葉pj別）、年間構成比の円グラフ
- **プロジェクトツリー** — pj の再帰ツリーを CRUD。葉には tracker を付けて issue / task を持たせる
- **マスタ管理** — ワーカーの CRUD
- **工数入力** — ワーカー別ルートで、担当する task の 12 か月分の実績を入力
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
pj (再帰ツリー)
 ├─ pj_members ── workers
 └─ tracker           ← 行の存在 = この pj は葉
      ├─ issues       ← 階層あり・期日・担当は任意
      └─ tasks        ← 階層なし・時刻付き期間・担当1名必須
           └─ task_entries   ← 実績拡張層（year × month × hours）
```

- **pj** は自己参照の再帰ツリー。`fiscal_year` / `budget_amount` を持つノードが契約（受注）として集計対象になる。
- **葉**（tracker 行を持つ pj）だけが issue・task を持てる。
- **task** の予定工数は保存せず、開始・終了時刻の期間から都度算出する（当初工数は持たない）。
- **task_entries** は worker が入力する実績で、task × 年 × 月で一意。

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
