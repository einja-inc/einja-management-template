export interface RouteNode {
  segment: string;
  routePath: string;
  hasSpecMd: boolean;
  hasPageTsx: boolean;
  hasQATest: boolean;
  children: RouteNode[];
}

export interface DocFile {
  slug: string[];
  title: string;
  section: string;
}

export interface IntegrationTestFile {
  slug: string[];
  title: string;
}

// 新規: 複数アプリ対応
export interface AppScanTarget {
  name: string;
  label: string;
  appDir: string;
  qaTestDir?: string;
}

export interface AppRoutes {
  appName: string;
  label: string;
  routes: RouteNode[];
}

// 新規: Issue仕様書対応
export interface IssueSpec {
  slug: string[];
  title: string;
  category: string;
  hasRequirements: boolean;
  hasDesign: boolean;
  hasQATests: boolean;
}

// 拡張 ScanResult
export interface ScanResult {
  appRoutes: AppRoutes[];
  issueSpecs: IssueSpec[];
  integrationTests: IntegrationTestFile[];
  docs: DocFile[];
}
