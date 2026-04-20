"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === "dark" ? "dark" : "default",
          securityLevel: "strict",
        });

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, chart);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Mermaid render error");
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, resolvedTheme]);

  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.25, 3)), []);
  const zoomOut = useCallback(
    () => setScale((s) => Math.max(s - 0.25, 0.25)),
    [],
  );
  const zoomReset = useCallback(() => setScale(1), []);

  if (error) {
    return (
      <pre className="overflow-auto rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        <code>{chart}</code>
        <p className="mt-2 text-xs">{error}</p>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-muted/50">
        <span className="text-sm text-muted-foreground">描画中...</span>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border border-border">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        <span className="text-xs text-muted-foreground mr-auto">Mermaid</span>
        <button
          type="button"
          onClick={zoomOut}
          className="rounded p-1 hover:bg-muted"
          title="縮小"
          aria-label="縮小"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          className="rounded p-1 hover:bg-muted"
          title="拡大"
          aria-label="拡大"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={zoomReset}
          className="rounded p-1 hover:bg-muted"
          title="リセット"
          aria-label="リセット"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="overflow-auto p-4" ref={containerRef}>
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid.render() produces sanitized SVG
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
