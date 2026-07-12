import Link from "next/link";

/** 404 ページ。 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-5xl font-bold text-indigo-600">404</p>
      <h2 className="mt-4 text-lg font-semibold">
        ページが見つかりませんでした
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        お探しのページは移動または削除された可能性があります。
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        ダッシュボードへ戻る
      </Link>
    </div>
  );
}
