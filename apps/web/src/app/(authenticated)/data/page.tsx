"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Edit, Eye, MoreHorizontal, Trash2 } from "lucide-react";

// サンプルデータの型定義
interface User {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "pending";
  role: "admin" | "user" | "moderator";
  createdAt: string;
  lastLogin: string;
}

// サンプルデータ
const sampleUsers: User[] = [
  {
    id: "1",
    name: "田中太郎",
    email: "tanaka@example.com",
    status: "active",
    role: "admin",
    createdAt: "2024-01-15",
    lastLogin: "2024-01-20",
  },
  {
    id: "2",
    name: "佐藤花子",
    email: "sato@example.com",
    status: "active",
    role: "user",
    createdAt: "2024-01-16",
    lastLogin: "2024-01-19",
  },
  {
    id: "3",
    name: "鈴木一郎",
    email: "suzuki@example.com",
    status: "inactive",
    role: "user",
    createdAt: "2024-01-10",
    lastLogin: "2024-01-12",
  },
  {
    id: "4",
    name: "高橋美咲",
    email: "takahashi@example.com",
    status: "pending",
    role: "moderator",
    createdAt: "2024-01-18",
    lastLogin: "2024-01-18",
  },
  {
    id: "5",
    name: "伊藤健太",
    email: "ito@example.com",
    status: "active",
    role: "user",
    createdAt: "2024-01-12",
    lastLogin: "2024-01-21",
  },
  {
    id: "6",
    name: "山田恵子",
    email: "yamada@example.com",
    status: "active",
    role: "admin",
    createdAt: "2024-01-08",
    lastLogin: "2024-01-20",
  },
  {
    id: "7",
    name: "中村誠",
    email: "nakamura@example.com",
    status: "inactive",
    role: "user",
    createdAt: "2024-01-05",
    lastLogin: "2024-01-10",
  },
  {
    id: "8",
    name: "小林優子",
    email: "kobayashi@example.com",
    status: "pending",
    role: "user",
    createdAt: "2024-01-22",
    lastLogin: "2024-01-22",
  },
];

// ステータスバッジのスタイルを定義する関数
const getStatusBadge = (status: User["status"]) => {
  switch (status) {
    case "active":
      return <Badge variant="default">アクティブ</Badge>;
    case "inactive":
      return <Badge variant="secondary">非アクティブ</Badge>;
    case "pending":
      return <Badge variant="outline">保留中</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// ロールバッジのスタイルを定義する関数
const getRoleBadge = (role: User["role"]) => {
  switch (role) {
    case "admin":
      return <Badge variant="destructive">管理者</Badge>;
    case "moderator":
      return <Badge variant="default">モデレーター</Badge>;
    case "user":
      return <Badge variant="secondary">ユーザー</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
};

// テーブルの列定義
const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          名前
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue("name")}</div>;
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          メールアドレス
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return <div className="text-muted-foreground">{row.getValue("email")}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "ステータス",
    cell: ({ row }) => {
      const status = row.getValue("status") as User["status"];
      return getStatusBadge(status);
    },
  },
  {
    accessorKey: "role",
    header: "ロール",
    cell: ({ row }) => {
      const role = row.getValue("role") as User["role"];
      return getRoleBadge(role);
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          作成日
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"));
      return <div>{date.toLocaleDateString("ja-JP")}</div>;
    },
  },
  {
    accessorKey: "lastLogin",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          最終ログイン
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("lastLogin"));
      return <div>{date.toLocaleDateString("ja-JP")}</div>;
    },
  },
  {
    id: "actions",
    header: "操作",
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">メニューを開く</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => console.log("詳細表示:", user.id)}>
              <Eye className="mr-2 h-4 w-4" />
              詳細表示
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log("編集:", user.id)}>
              <Edit className="mr-2 h-4 w-4" />
              編集
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => console.log("削除:", user.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function DataPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">データ管理</h1>
          <p className="text-muted-foreground">ユーザーデータの管理と操作を行うことができます。</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ユーザー一覧</CardTitle>
            <CardDescription>
              システムに登録されているユーザーの一覧です。検索、フィルタリング、ソートが可能です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={sampleUsers}
              searchKey="name"
              searchPlaceholder="ユーザー名で検索..."
              enableColumnVisibility={true}
              enablePagination={true}
              pageSize={5}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
