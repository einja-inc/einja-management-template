"use client";

import { type UserFilters, useUsers } from "@/hooks/api/use-users";
import type { PaginatedUserList } from "@/shared/schemas/user";
import { UserTable } from "./UserTable";

interface UserTableContainerProps {
  initialData?: PaginatedUserList;
  filters?: UserFilters;
}

/**
 * UserTableContainer
 *
 * Client Component - Tanstack Queryでデータ管理
 */
export function UserTableContainer({ initialData, filters = {} }: UserTableContainerProps) {
  const { data, isLoading, error } = useUsers(filters, initialData);

  const handleView = (userId: string) => {
    console.log("詳細表示:", userId);
    // TODO: 詳細ページへの遷移やモーダル表示
  };

  const handleEdit = (userId: string) => {
    console.log("編集:", userId);
    // TODO: 編集ページへの遷移やモーダル表示
  };

  const handleDelete = (userId: string) => {
    console.log("削除:", userId);
    // TODO: 削除確認モーダル表示とAPI呼び出し
  };

  if (error) {
    return <div className="text-destructive">エラーが発生しました: {error.message}</div>;
  }

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  if (!data) {
    return <div>データがありません</div>;
  }

  return (
    <UserTable users={data.items} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
  );
}
