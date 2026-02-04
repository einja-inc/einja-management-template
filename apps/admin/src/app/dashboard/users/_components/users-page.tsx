"use client";

import { users } from "@/data/users";
import { UsersDialogs } from "./users-dialogs";
import { UsersPrimaryButtons } from "./users-primary-buttons";
import { UsersProvider } from "./users-provider";
import { UsersTable } from "./users-table";

export function UsersPage() {
  return (
    <UsersProvider>
      <div className="flex flex-1 flex-col gap-4 sm:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">User List</h2>
            <p className="text-muted-foreground">Manage your users and their roles here.</p>
          </div>
          <UsersPrimaryButtons />
        </div>
        <UsersTable data={users} />
      </div>

      <UsersDialogs />
    </UsersProvider>
  );
}
