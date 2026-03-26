export function segmentToLabel(segment: string): string {
  const cleaned = segment
    .replace(/^\[\.\.\./, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "");
  return cleaned
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function docSectionToTitle(section: string): string {
  const map: Record<string, string> = {
    features: "機能設計",
    api: "API仕様",
    db: "DBスキーマ",
    errors: "エラー定義",
    requirements: "要件定義",
    diagrams: "図表",
    specs: "仕様書",
  };
  return map[section] ?? section.charAt(0).toUpperCase() + section.slice(1);
}

export function extractMarkdownTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}
