"use client";

import { CommandMenu } from "@repo/admin-ui/command-menu";
import { SidebarInset, SidebarProvider } from "@repo/admin-ui/ui/sidebar";
import { useMemo } from "react";
import { docSectionToTitle, segmentToLabel } from "@/lib/path-utils";
import type { AppRoutes, RouteNode, ScanResult } from "@/lib/types";
import { AppSidebar } from "./app-sidebar";

interface SpecViewerLayoutProps {
  children: React.ReactNode;
  scanResult: ScanResult;
}

function flattenRoutes(
  nodes: RouteNode[],
  appName: string,
  appLabel: string,
  parentLabel?: string,
): { title: string; url: string }[] {
  const items: { title: string; url: string }[] = [];
  for (const node of nodes) {
    const label = segmentToLabel(node.segment);
    const title = parentLabel
      ? `${parentLabel} / ${label}`
      : `[${appLabel}] ${label}`;
    items.push({ title, url: `/apps/${appName}/${node.routePath}` });
    if (node.children.length > 0) {
      items.push(
        ...flattenRoutes(node.children, appName, appLabel, title),
      );
    }
  }
  return items;
}

export function SpecViewerLayout({
  children,
  scanResult,
}: SpecViewerLayoutProps) {
  const navGroups = useMemo(() => {
    const pageItems = scanResult.appRoutes
      .flatMap((app) =>
        flattenRoutes(app.routes, app.appName, app.label),
      )
      .sort((a, b) => a.title.localeCompare(b.title));

    const issueItems = scanResult.issueSpecs
      .map((issue) => ({
        title: issue.title,
        url: `/issues/${issue.slug.join("/")}/${
          issue.hasRequirements ? "requirements.md" : "design.md"
        }`,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    const docsBySection = new Map<string, { title: string; url: string }[]>();
    for (const doc of scanResult.docs) {
      const section = doc.section;
      const existing = docsBySection.get(section) ?? [];
      if (!docsBySection.has(section)) {
        docsBySection.set(section, existing);
      }
      existing.push({
        title: doc.title,
        url: `/docs/${doc.slug.join("/")}`,
      });
    }

    const docGroups = Array.from(docsBySection.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, items]) => ({
        title: docSectionToTitle(section),
        items: items
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((item) => ({ title: item.title, url: item.url })),
      }));

    const integrationItems = scanResult.integrationTests
      .map((test) => ({
        title: test.title,
        url: `/integration-tests/${test.slug.join("/")}`,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return [
      {
        title: "画面仕様",
        items: pageItems.map((item) => ({ title: item.title, url: item.url })),
      },
      {
        title: "Issue 仕様書",
        items: issueItems,
      },
      {
        title: "統合テスト",
        items: integrationItems,
      },
      ...docGroups,
    ];
  }, [scanResult]);

  return (
    <SidebarProvider>
      <AppSidebar scanResult={scanResult} />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        {children}
      </SidebarInset>
      <CommandMenu navGroups={navGroups} />
    </SidebarProvider>
  );
}
