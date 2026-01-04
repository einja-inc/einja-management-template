import { userUseCases } from "@/application/use-cases/UserUseCases";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserTable } from "./_components/UserTable";

export default async function DataPage() {
  const result = await userUseCases.list({}, { page: 1, limit: 100 });

  if (!result.isSuccess) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">データ管理</h1>
            <p className="text-muted-foreground">
              ユーザーデータの管理と操作を行うことができます。
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>エラー</CardTitle>
              <CardDescription>データの取得中にエラーが発生しました。</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{result.error.message}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { items: users } = result.value;

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">データ管理</h1>
          <p className="text-muted-foreground">ユーザーデータの管理と操作を行うことができます。</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ユーザー一覧</CardTitle>
            <CardDescription>
              システムに登録されているユーザーの一覧です。検索、フィルタリング、ソートが可能です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserTable users={users} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
