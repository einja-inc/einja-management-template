import { Button } from "@repo/admin-ui/ui/button";
import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">ページが見つかりません</p>
      <Button asChild>
        <Link href="/dashboard">ダッシュボードに戻る</Link>
      </Button>
    </div>
  );
}
