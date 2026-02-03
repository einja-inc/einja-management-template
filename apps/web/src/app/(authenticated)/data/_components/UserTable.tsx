"use client";

import type { UserListItem } from "@/application/use-cases/UserUseCases";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { DataTable } from "@repo/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Edit, Eye, MoreHorizontal, Trash2 } from "lucide-react";

/**
 * ステータスバッジを表示
 */
function getStatusBadge(status: UserListItem["status"]) {
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
}

/**
 * ロールバッジを表示
 */
function getRoleBadge(role: UserListItem["role"]) {
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
}

/**
 * 日付をフォーマット
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP");
}

/**
 * テーブルの列定義を生成
 */
function createColumns(
  onView?: (userId: string) => void,
  onEdit?: (userId: string) => void,
  onDelete?: (userId: string) => void
): ColumnDef<UserListItem>[] {
  return [
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
        const name = row.getValue("name") as string;
        return <div className="font-medium">{name || "-"}</div>;
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
        const status = row.getValue("status") as UserListItem["status"];
        return getStatusBadge(status);
      },
    },
    {
      accessorKey: "role",
      header: "ロール",
      cell: ({ row }) => {
        const role = row.getValue("role") as UserListItem["role"];
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
        return <div>{formatDate(row.getValue("createdAt"))}</div>;
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
        return <div>{formatDate(row.getValue("lastLogin"))}</div>;
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
              <DropdownMenuItem onClick={() => onView?.(user.id)}>
                <Eye className="mr-2 h-4 w-4" />
                詳細表示
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(user.id)}>
                <Edit className="mr-2 h-4 w-4" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(user.id)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

interface UserTableProps {
  users: readonly UserListItem[];
  onView?: (userId: string) => void;
  onEdit?: (userId: string) => void;
  onDelete?: (userId: string) => void;
}

/**
 * ユーザーテーブルコンポーネント
 */
export function UserTable({ users, onView, onEdit, onDelete }: UserTableProps) {
  const columns = createColumns(onView, onEdit, onDelete);

  return (
    <DataTable
      columns={columns}
      data={users as UserListItem[]}
      searchKey="name"
      searchPlaceholder="ユーザー名で検索..."
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={10}
    />
  );
}
