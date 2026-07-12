-- 年間稼働トラッカー — 本番向け RLS ポリシー（認証必須）
--
-- schema.sql のデモ用ポリシー（anon に全許可）を、
-- 「ログイン済みユーザーのみ読み書き可」に置き換えます。
-- Supabase Auth を導入したうえで、SQL Editor で実行してください。
--
-- ※ さらに厳密なマルチテナント制御（組織ごとの分離）が必要な場合は、
--   各テーブルに org_id / owner を持たせ auth.uid() で絞り込むポリシーへ拡張します。

do $$
declare
  t text;
begin
  foreach t in array array[
    'teams', 'workers', 'clients', 'orders', 'projects',
    'milestones', 'assignments', 'achievements', 'entries'
  ] loop
    -- デモ用の全許可ポリシーを削除
    execute format('drop policy if exists %I on public.%I', t || '_all', t);

    -- 認証済みユーザーのみ許可するポリシーを作成
    if not exists (
      select 1 from pg_policies
      where tablename = t and policyname = t || '_authenticated'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        t || '_authenticated', t
      );
    end if;
  end loop;
end $$;
