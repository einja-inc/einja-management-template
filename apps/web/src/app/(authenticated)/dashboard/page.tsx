import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { H1, P } from "@repo/ui/typography";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <main className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
        <div className="space-y-8">
          {/* ページタイトル */}
          <div className="space-y-2">
            <H1>管理画面ダッシュボード</H1>
            <P className="text-muted-foreground">
              ようこそ、{session?.user?.name || session?.user?.email}さん
            </P>
          </div>

          {/* 統計情報カード */}
          <DashboardStats />

          {/* メインコンテンツエリア */}
          <Card>
            <CardHeader>
              <CardTitle>管理機能</CardTitle>
              <CardDescription>各種管理機能にアクセスできます</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <h3 className="font-semibold">ユーザー管理</h3>
                  <p className="text-sm text-muted-foreground mt-1">ユーザーの作成、編集、削除</p>
                </div>
                <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <h3 className="font-semibold">データ管理</h3>
                  <p className="text-sm text-muted-foreground mt-1">データベースの管理と操作</p>
                </div>
                <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <h3 className="font-semibold">設定</h3>
                  <p className="text-sm text-muted-foreground mt-1">システム設定の管理</p>
                </div>
                <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <h3 className="font-semibold">レポート</h3>
                  <p className="text-sm text-muted-foreground mt-1">各種レポートの生成</p>
                </div>
                <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <h3 className="font-semibold">ログ監視</h3>
                  <p className="text-sm text-muted-foreground mt-1">システムログの監視</p>
                </div>
                <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <h3 className="font-semibold">API管理</h3>
                  <p className="text-sm text-muted-foreground mt-1">API キーとアクセス管理</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
