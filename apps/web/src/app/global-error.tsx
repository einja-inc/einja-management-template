"use client";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorPageProps) {
  const handleHomeClick = () => {
    window.location.href = "/";
  };

  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
          <div className="text-center">
            <h1 className="mb-4">システムエラー</h1>
            <p className="text-gray-600 mb-8 text-lg">申し訳ありません。システムエラーが発生しました。</p>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 active:bg-blue-700 transition-all duration-200"
              >
                もう一度試す
              </button>
              <button
                type="button"
                onClick={handleHomeClick}
                className="inline-flex items-center justify-center px-6 py-3 border border-blue-500 text-blue-500 font-semibold rounded-md hover:bg-blue-50 active:bg-blue-100 transition-all duration-200"
              >
                トップページへ戻る
              </button>
            </div>
            {process.env.NODE_ENV === "development" && (
              <pre className="mt-8 p-4 bg-gray-100 rounded-md text-left overflow-auto max-w-full font-mono text-sm">
                {error.message}
              </pre>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
