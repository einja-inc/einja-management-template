"use client";

import { Button } from "@repo/admin-ui/ui/button";
import { Columns2, FileText, FlaskConical } from "lucide-react";
import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { MarkdownRenderer } from "./markdown/markdown-renderer";

type ViewMode = "spec" | "split" | "qa";

interface SpecPageContentProps {
  specContent: string;
  qaContent: string | null;
}

function ViewModeToggle({
  mode,
  onModeChange,
}: {
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
}) {
  return (
    <div className="flex justify-end pb-2">
      <div className="inline-flex rounded-md border border-input">
        <Button
          variant={mode === "spec" ? "default" : "ghost"}
          size="sm"
          className="rounded-r-none border-0"
          onClick={() => onModeChange("spec")}
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          仕様書
        </Button>
        <Button
          variant={mode === "split" ? "default" : "ghost"}
          size="sm"
          className="rounded-none border-x border-input"
          onClick={() => onModeChange("split")}
        >
          <Columns2 className="mr-1.5 h-3.5 w-3.5" />
          並列
        </Button>
        <Button
          variant={mode === "qa" ? "default" : "ghost"}
          size="sm"
          className="rounded-l-none border-0"
          onClick={() => onModeChange("qa")}
        >
          <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
          QA テスト
        </Button>
      </div>
    </div>
  );
}

export function SpecPageContent({
  specContent,
  qaContent,
}: SpecPageContentProps) {
  const [mode, setMode] = useState<ViewMode>("spec");

  if (!qaContent) {
    return <MarkdownRenderer content={specContent} />;
  }

  if (mode === "spec") {
    return (
      <>
        <ViewModeToggle mode={mode} onModeChange={setMode} />
        <MarkdownRenderer content={specContent} />
      </>
    );
  }

  if (mode === "qa") {
    return (
      <>
        <ViewModeToggle mode={mode} onModeChange={setMode} />
        <MarkdownRenderer content={qaContent} />
      </>
    );
  }

  return (
    <div
      className="flex w-full flex-col overflow-hidden"
      style={{ height: "calc(100svh - 7rem)" }}
    >
      <ViewModeToggle mode={mode} onModeChange={setMode} />
      <PanelGroup direction="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize={55} minSize={30}>
          <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden pr-4">
            <MarkdownRenderer content={specContent} />
          </div>
        </Panel>
        <PanelResizeHandle className="mx-1 w-1.5 rounded-full bg-border transition-colors hover:bg-primary/50" />
        <Panel defaultSize={45} minSize={25}>
          <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden pl-4">
            <div className="mb-4 flex items-center gap-2 border-b pb-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">
                QA テスト
              </h2>
            </div>
            <MarkdownRenderer content={qaContent} />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
