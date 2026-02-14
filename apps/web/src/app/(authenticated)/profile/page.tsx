import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    return <div>ユーザー情報が見つかりません</div>;
  }

  const { user } = session;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">プロフィール</h1>
        <p className="text-muted-foreground">あなたのアカウント情報を確認できます。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ユーザー情報</CardTitle>
          <CardDescription>現在のアカウント情報です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">名前</span>
              <p className="text-sm">{user.name || "未設定"}</p>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">メールアドレス</span>
              <p className="text-sm">{user.email || "未設定"}</p>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">ユーザーID</span>
              <p className="text-sm font-mono">{user.id || "未設定"}</p>
            </div>

            {user.image && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">プロフィール画像</span>
                <div className="mt-2">
                  {/* biome-ignore lint/performance/noImgElement: Next.js Imageへの移行は別タスクで対応 */}
                  <img
                    src={user.image}
                    alt={user.name || "Profile"}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
