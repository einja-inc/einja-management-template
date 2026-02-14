"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/admin-ui/ui/alert";
import { ConfirmDialog } from "@repo/admin-ui/ui/confirm-dialog";
import { Input } from "@repo/admin-ui/ui/input";
import { Label } from "@repo/admin-ui/ui/label";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { User } from "@/data/users";

type UserDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow: User;
};

export function UsersDeleteDialog({ open, onOpenChange, currentRow }: UserDeleteDialogProps) {
  const [value, setValue] = useState("");

  const handleDelete = () => {
    if (value.trim() !== currentRow.username) return;

    onOpenChange(false);
    toast.success("User deleted successfully!");
    console.log("Deleted user:", currentRow);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      disabled={value.trim() !== currentRow.username}
      title={
        <span className="text-destructive">
          <AlertTriangle className="me-1 inline-block stroke-destructive" size={18} /> Delete User
        </span>
      }
      desc={
        <div className="space-y-4">
          <p className="mb-2">
            Are you sure you want to delete <span className="font-bold">{currentRow.username}</span>
            ?
            <br />
            This action will permanently remove the user with the role of{" "}
            <span className="font-bold">{currentRow.role.toUpperCase()}</span> from the system. This
            cannot be undone.
          </p>

          <Label className="my-2">
            Username:
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter username to confirm deletion."
            />
          </Label>

          <Alert variant="destructive">
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              Please be careful, this operation can not be rolled back.
            </AlertDescription>
          </Alert>
        </div>
      }
      confirmText="Delete"
      destructive
    />
  );
}
