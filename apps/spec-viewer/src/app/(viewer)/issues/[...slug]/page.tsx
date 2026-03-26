import { Header, Main } from "@repo/admin-ui/layout";
import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { readIssueSpecFile } from "@/lib/file-scanner";
import { extractMarkdownTitle, segmentToLabel } from "@/lib/path-utils";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function IssueSpecPage({ params }: PageProps) {
  const { slug } = await params;
  const content = readIssueSpecFile(slug);

  if (!content) {
    notFound();
  }

  const fileName = slug[slug.length - 1]
    .replace(/\.md$/, "")
    .replace(/-/g, " ");
  const fallbackTitle = fileName.charAt(0).toUpperCase() + fileName.slice(1);
  const title = extractMarkdownTitle(content) ?? fallbackTitle;

  return (
    <>
      <Header>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
      </Header>
      <Main>
        <MarkdownRenderer content={content} />
      </Main>
    </>
  );
}
