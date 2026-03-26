import { Header, Main } from "@repo/admin-ui/layout";
import { getScanResult } from "@/lib/file-scanner";
import type { RouteNode } from "@/lib/types";

interface PageProps {
  params: Promise<{ app: string }>;
}

function countRoutes(nodes: RouteNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countRoutes(n.children), 0);
}

function countRoutesWithSpec(nodes: RouteNode[]): number {
  return nodes.reduce(
    (sum, n) => sum + (n.hasSpecMd ? 1 : 0) + countRoutesWithSpec(n.children),
    0,
  );
}

export default async function AppPagesIndexPage({ params }: PageProps) {
  const { app } = await params;
  const { appRoutes } = getScanResult();
  const appData = appRoutes.find((a) => a.appName === app);
  const routes = appData?.routes ?? [];
  const totalRoutes = countRoutes(routes);
  const routesWithSpec = countRoutesWithSpec(routes);

  return (
    <>
      <Header>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {appData?.label ?? app} 画面仕様一覧
          </h1>
        </div>
      </Header>
      <Main>
        <p className="text-muted-foreground text-sm mb-6">
          全 {totalRoutes} 画面中 {routesWithSpec} 画面に spec.md あり
        </p>
        <p className="text-sm text-muted-foreground">
          左のサイドバーから画面を選択してください。
        </p>
      </Main>
    </>
  );
}
