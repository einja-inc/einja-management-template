import { Header, Main } from "@repo/admin-ui/layout";
import { getScanResult } from "@/lib/file-scanner";

export default function IntegrationTestsIndexPage() {
  const { integrationTests } = getScanResult();

  return (
    <>
      <Header>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">統合テスト一覧</h1>
        </div>
      </Header>
      <Main>
        <p className="mb-6 text-sm text-muted-foreground">
          全 {integrationTests.length} 件の統合テスト仕様があります
        </p>
        <p className="text-sm text-muted-foreground">
          左のサイドバーから統合テストを選択してください。
        </p>
      </Main>
    </>
  );
}
