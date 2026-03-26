import { Header, Main } from "@repo/admin-ui/layout";
import { SpecPageContent } from "@/components/spec-page-content";
import { readQATestMd, readSpecMd } from "@/lib/file-scanner";
import { segmentToLabel } from "@/lib/path-utils";

interface PageProps {
  params: Promise<{ app: string; slug: string[] }>;
}

export default async function SpecPage({ params }: PageProps) {
  const { app, slug } = await params;
  const content = readSpecMd(app, slug);
  const qaContent = readQATestMd(app, slug);
  const pageTitle = segmentToLabel(slug[slug.length - 1]);

  if (!content) {
    return (
      <>
        <Header>
          <div className="mb-2 flex items-center justify-between space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          </div>
        </Header>
        <Main>
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p className="text-sm">このページには spec.md がまだありません。</p>
            <p className="mt-2 text-xs font-mono">
              apps/{app}/src/app/{slug.join("/")}/spec.md
            </p>
          </div>
        </Main>
      </>
    );
  }

  return (
    <>
      <Header>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
        </div>
      </Header>
      <Main>
        <SpecPageContent specContent={content} qaContent={qaContent} />
      </Main>
    </>
  );
}
