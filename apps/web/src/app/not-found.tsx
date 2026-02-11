import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="text-center">
        <h1 className="mb-4">404 - Page Not Found</h1>
        <p className="text-gray-600 mb-8 text-lg">
          申し訳ありません。お探しのページが見つかりませんでした。
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 active:bg-blue-700 transition-all duration-200"
        >
          トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
