"use client";

import { Header } from "@repo/admin-ui/layout";
import { Main } from "@repo/admin-ui/layout";
import { Button } from "@repo/admin-ui/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/admin-ui/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/admin-ui/ui/tabs";
import { Download } from "lucide-react";
import { Analytics } from "./analytics";
import { MetricCards } from "./metric-cards";
import { OverviewChart } from "./overview-chart";
import { RecentSales } from "./recent-sales";

export function DashboardPage() {
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center space-x-2">
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <Tabs orientation="vertical" defaultValue="overview" className="space-y-4">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="reports" disabled>
                Reports
              </TabsTrigger>
              <TabsTrigger value="notifications" disabled>
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview" className="space-y-4">
            <MetricCards />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
              <Card className="col-span-1 lg:col-span-4">
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="ps-2">
                  <OverviewChart />
                </CardContent>
              </Card>
              <Card className="col-span-1 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Recent Sales</CardTitle>
                  <CardDescription>You made 265 sales this month.</CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentSales />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="analytics" className="space-y-4">
            <Analytics />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  );
}
