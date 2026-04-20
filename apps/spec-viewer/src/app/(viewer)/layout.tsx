import { SpecViewerLayout } from "@/components/layout/spec-viewer-layout";
import { getScanResult } from "@/lib/file-scanner";

export default function ViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scanResult = getScanResult();
  return (
    <SpecViewerLayout scanResult={scanResult}>{children}</SpecViewerLayout>
  );
}
