import { Header, Main } from "@repo/admin-ui/layout";
import { getScanResult } from "@/lib/file-scanner";

export default function IssueSpecsIndexPage() {
  const { issueSpecs } = getScanResult();

  return (
    <>
      <Header>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Issue 仕様書一覧
          </h1>
        </div>
      </Header>
      <Main>
        <p className="mb-6 text-sm text-muted-foreground">
          全 {issueSpecs.length} 件の Issue 仕様書があります
        </p>
        <p className="text-sm text-muted-foreground">
          左のサイドバーから仕様書を選択してください。
        </p>
      </Main>
    </>
  );
}
