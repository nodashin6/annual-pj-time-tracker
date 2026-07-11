# 年間稼働トラッカー (annual-pj-time-tracker)

プロジェクトの**工数・稼働率・キャパシティ**を、**月次／年次**で集計・可視化する稼働管理アプリです。

チームの年間稼働を俯瞰し、「誰がどのプロジェクトにどれだけ入っているか」「稼働率は適正か（過負荷／空き）」を素早く把握することを目的としています。

## 主な機能

- **月次・年次の集計** — プロジェクト別／メンバー別に工数を自動集計
- **稼働率・キャパ管理** — メンバーごとの月あたりキャパを分母に稼働率を算出（過負荷/適正/空きを色分け）
- **グラフ可視化**
  - 月次工数の積み上げ棒グラフ（プロジェクト別）
  - 月次稼働率の折れ線（メンバー別・100%基準線つき）
  - 年間プロジェクト構成比の円グラフ
- **工数入力** — メンバー×プロジェクトのマトリクスで月次入力
- **年切り替え** — 複数年のデータを保持し、対象年を切り替えて表示

## 技術スタック

- [Next.js 15](https://nextjs.org/)（App Router） + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) によるグラフ描画
- [Zustand](https://github.com/pmndrs/zustand) でクライアント状態を管理
- **バックエンド: [Supabase](https://supabase.com/)（PostgreSQL）** — メンバー / プロジェクト / 工数を永続化

## セットアップ

### 1. Supabase を用意

1. [Supabase](https://supabase.com/) でプロジェクトを作成。
2. ダッシュボードの **SQL Editor** で [`supabase/schema.sql`](supabase/schema.sql) を実行（テーブル作成＋サンプルデータ投入）。
3. **Project Settings > API** から `Project URL` と `anon public` キーを取得。

### 2. 環境変数

`.env.local.example` を `.env.local` にコピーし、値を設定します。

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### 3. 起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開きます。環境変数が未設定の場合は、画面に設定手順が表示されます。

### ビルド

```bash
npm run build
npm start
```

## 使い方

1. **メンバー・PJ設定** タブで、メンバー（＋月あたりキャパ）とプロジェクトを登録します。
2. **工数入力** タブで、月を選びメンバー×プロジェクトの工数（時間）を入力します。
3. **ダッシュボード** タブで、月次・年次の集計とグラフ、メンバー別稼働率を確認します。

## データモデル

- `members` — メンバー（`monthly_capacity_hours` = 月あたり標準稼働時間）
- `projects` — プロジェクト（表示色・顧客名を保持）
- `entries` — 工数エントリ（メンバー × プロジェクト × 年月 の時間、この4項目で一意）

稼働率 = 投下工数 ÷ キャパ（メンバー月次 or 年間合計）。

> RLS は動作確認しやすいよう anon の読み書きを許可しています。実運用ではユーザー認証（`auth.uid()` ベースのポリシー）に置き換えてください。

## ライセンス

MIT
