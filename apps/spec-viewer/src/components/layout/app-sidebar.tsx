"use client";

import { ThemeSwitch } from "@repo/admin-ui/layout";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/admin-ui/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/admin-ui/ui/sidebar";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  FileText,
  FlaskConical,
  Globe,
  Monitor,
  Pencil,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { docSectionToTitle, segmentToLabel } from "@/lib/path-utils";
import type {
  DocFile,
  IntegrationTestFile,
  IssueSpec,
  RouteNode,
  ScanResult,
} from "@/lib/types";

function getAppIcon(appName: string) {
  switch (appName) {
    case "web":
      return Globe;
    case "admin":
      return Shield;
    default:
      return Monitor;
  }
}

function RouteNodeItem({
  node,
  appName,
}: {
  node: RouteNode;
  appName: string;
}) {
  const pathname = usePathname();
  const href = `/apps/${appName}/${node.routePath}`;
  const isActive = pathname === href;
  const isInSubtree = pathname.startsWith(`${href}/`);

  const icon = node.hasSpecMd ? (
    <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
  ) : (
    <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
  );

  const qaBadge = node.hasQATest ? (
    <FlaskConical className="h-3 w-3 shrink-0 text-violet-500" />
  ) : null;

  if (node.children.length === 0) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive}>
          <Link href={href}>
            {icon}
            <span>{segmentToLabel(node.segment)}</span>
            {qaBadge}
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <Collapsible
      defaultOpen={isActive || isInSubtree}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={href}>
            {icon}
            <span>{segmentToLabel(node.segment)}</span>
            {qaBadge}
          </Link>
        </SidebarMenuButton>
        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            aria-label="サブメニューを展開"
            className="rounded-md bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
          >
            <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {node.children.map((child) => (
              <RouteNodeItem
                key={child.routePath}
                node={child}
                appName={appName}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function IssueSpecCategory({
  category,
  issues,
}: {
  category: string;
  issues: IssueSpec[];
}) {
  const pathname = usePathname();
  const isInCategory = issues.some((issue) =>
    pathname.startsWith(`/issues/${issue.slug.join("/")}`),
  );

  return (
    <Collapsible defaultOpen={isInCategory} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <span className="font-medium">{category}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {issues.map((issue) => {
              const defaultFile = issue.hasRequirements
                ? "requirements.md"
                : "design.md";
              const href = `/issues/${issue.slug.join("/")}/${defaultFile}`;
              const isActive = pathname.startsWith(
                `/issues/${issue.slug.join("/")}`,
              );

              return (
                <SidebarMenuSubItem key={issue.slug.join("/")}>
                  <SidebarMenuSubButton asChild isActive={isActive}>
                    <Link href={href}>
                      <span className="truncate">{issue.title}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-0.5">
                        {issue.hasRequirements && (
                          <ClipboardList className="h-3 w-3 text-blue-500" />
                        )}
                        {issue.hasDesign && (
                          <Pencil className="h-3 w-3 text-orange-500" />
                        )}
                        {issue.hasQATests && (
                          <FlaskConical className="h-3 w-3 text-violet-500" />
                        )}
                      </span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function DocSection({ section, files }: { section: string; files: DocFile[] }) {
  const pathname = usePathname();
  const sectionHref = `/docs/${section}`;
  const isInSection = pathname.startsWith(sectionHref);

  return (
    <Collapsible defaultOpen={isInSection} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <span className="font-medium">{docSectionToTitle(section)}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {files.map((file) => {
              const href = `/docs/${file.slug.join("/")}`;
              const isActive = pathname === href;
              return (
                <SidebarMenuSubItem key={href}>
                  <SidebarMenuSubButton asChild isActive={isActive}>
                    <Link href={href}>
                      <FileText className="h-3 w-3 shrink-0" />
                      <span>{file.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function IntegrationTestLink({ test }: { test: IntegrationTestFile }) {
  const pathname = usePathname();
  const href = `/integration-tests/${test.slug.join("/")}`;
  const isActive = pathname === href;

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={isActive}>
        <Link href={href}>
          <FlaskConical className="h-3 w-3 shrink-0 text-amber-500" />
          <span>{test.title}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

export function AppSidebar({ scanResult }: { scanResult: ScanResult }) {
  const firstAppName = scanResult.appRoutes[0]?.appName ?? "web";

  const docsBySection = scanResult.docs.reduce<Record<string, DocFile[]>>(
    (acc, doc) => {
      if (!acc[doc.section]) acc[doc.section] = [];
      acc[doc.section].push(doc);
      return acc;
    },
    {},
  );

  const issuesByCategory = scanResult.issueSpecs.reduce<
    Record<string, IssueSpec[]>
  >((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {});

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={`/apps/${firstAppName}`}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  S
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Spec Viewer</span>
                  <span className="truncate text-xs">開発専用</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {scanResult.appRoutes.map((app) => {
          const AppIcon = getAppIcon(app.appName);
          return (
            <SidebarGroup key={app.appName}>
              <SidebarGroupLabel>
                <AppIcon className="mr-1 h-4 w-4" />
                {app.label} 画面仕様
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {app.routes.map((node) => (
                    <RouteNodeItem
                      key={node.routePath}
                      node={node}
                      appName={app.appName}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {scanResult.issueSpecs.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <FileText className="mr-1 h-4 w-4" />
              Issue 仕様書
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {Object.entries(issuesByCategory)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([category, issues]) => (
                    <IssueSpecCategory
                      key={category}
                      category={category}
                      issues={issues}
                    />
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>
            <FlaskConical className="mr-1 h-4 w-4" />
            統合テスト
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {scanResult.integrationTests.map((test) => (
                <IntegrationTestLink key={test.slug.join("/")} test={test} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            <BookOpen className="mr-1 h-4 w-4" />
            ドキュメント
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {Object.entries(docsBySection).map(([section, files]) => (
                <DocSection key={section} section={section} files={files} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <ThemeSwitch />
      </SidebarFooter>
    </Sidebar>
  );
}
