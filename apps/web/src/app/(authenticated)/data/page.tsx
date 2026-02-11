import { prefetchUsers } from "@/hooks/api/prefetch-users";
import type { PaginatedUserList } from "@/shared/schemas/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { UserTableContainer } from "./_components/UserTableContainer";

export default async function DataPage() {
  let initialData: PaginatedUserList | undefined;
  let error: string | undefined;

  const result = await prefetchUsers({ page: 1, limit: 100 });
  if (result === null) {
    error = "データの取得に失敗しました";
  } else {
    initialData = result;
  }

  if (error) {
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
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
            <UserTableContainer initialData={initialData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
