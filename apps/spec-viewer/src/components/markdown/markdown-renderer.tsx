"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./mermaid-diagram";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const pathname = usePathname();

  const components: Components = {
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || "");
      const lang = match?.[1];
      const text = String(children).replace(/\n$/, "");

      if (lang === "mermaid") {
        return <MermaidDiagram chart={text} />;
      }

      // Block code (has language class) — rendered inside custom <pre>
      if (className) {
        return <code className={className}>{children}</code>;
      }

      // Inline code — no className means react-markdown treats it as inline `code`
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
          {children}
        </code>
      );
    },
    a({ href, children, ...props }) {
      if (
        href &&
        !href.startsWith("http") &&
        !href.startsWith("/") &&
        !href.startsWith("#")
      ) {
        // Strip .md extension and resolve relative to current page path
        href = `${pathname}/${href.replace(/\.md$/, "")}`;
        return (
          <Link href={href} {...props}>
            {children}
          </Link>
        );
      }
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    },
    pre({ children }) {
      // Intercept mermaid: if child is MermaidDiagram, render without <pre> wrapper
      if (
        children &&
        typeof children === "object" &&
        "type" in children &&
        children.type === MermaidDiagram
      ) {
        return children;
      }
      return (
        <pre className="overflow-auto rounded-lg border border-border bg-muted/50 p-4">
          {children}
        </pre>
      );
    },
  };

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:pb-2 prose-h1:mb-4 prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2 prose-table:border-collapse prose-table:w-full prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-muted prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-img:rounded-lg prose-img:border prose-img:border-border prose-hr:border-border prose-li:marker:text-muted-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
