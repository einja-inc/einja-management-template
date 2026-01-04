"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type React from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface DialogOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  showCloseButton?: boolean;
}

interface DialogState {
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  showCloseButton?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  content?: React.ReactNode;
}

interface DialogContextType {
  openDialog: (
    options: DialogOptions & {
      onConfirm?: () => void | Promise<void>;
      onCancel?: () => void;
    }
  ) => void;
  openCustomDialog: (content: React.ReactNode, options?: DialogOptions) => void;
  closeDialog: () => void;
  confirm: (
    options: Omit<DialogOptions, "cancelText" | "confirmText"> & {
      message: string;
      confirmText?: string;
      cancelText?: string;
    }
  ) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    showCloseButton: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  const openDialog = useCallback(
    (
      options: DialogOptions & {
        onConfirm?: () => void | Promise<void>;
        onCancel?: () => void;
      }
    ) => {
      setDialogState({
        isOpen: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || "OK",
        cancelText: options.cancelText || "キャンセル",
        variant: options.variant || "default",
        showCloseButton: options.showCloseButton ?? true,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
      });
    },
    []
  );

  const openCustomDialog = useCallback((content: React.ReactNode, options?: DialogOptions) => {
    setDialogState({
      isOpen: true,
      content,
      showCloseButton: options?.showCloseButton ?? true,
      variant: options?.variant || "default",
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(false);
  }, []);

  const confirm = useCallback(
    (
      options: Omit<DialogOptions, "cancelText" | "confirmText"> & {
        message: string;
        confirmText?: string;
        cancelText?: string;
      }
    ) => {
      return new Promise<boolean>((resolve) => {
        setDialogState({
          isOpen: true,
          title: options.title || "確認",
          description: options.message,
          confirmText: options.confirmText || "OK",
          cancelText: options.cancelText || "キャンセル",
          variant: options.variant || "default",
          showCloseButton: options.showCloseButton ?? true,
          onConfirm: () => {
            resolve(true);
            closeDialog();
          },
          onCancel: () => {
            resolve(false);
            closeDialog();
          },
        });
      });
    },
    [closeDialog]
  );

  const handleConfirm = async () => {
    if (dialogState.onConfirm) {
      setIsLoading(true);
      try {
        await dialogState.onConfirm();
        closeDialog();
      } catch (error) {
        console.error("Dialog confirm error:", error);
        setIsLoading(false);
      }
    } else {
      closeDialog();
    }
  };

  const handleCancel = () => {
    if (dialogState.onCancel) {
      dialogState.onCancel();
    }
    closeDialog();
  };

  const contextValue: DialogContextType = {
    openDialog,
    openCustomDialog,
    closeDialog,
    confirm,
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <Dialog open={dialogState.isOpen} onOpenChange={(open: boolean) => !open && closeDialog()}>
        <DialogContent showCloseButton={dialogState.showCloseButton}>
          {dialogState.content ? (
            dialogState.content
          ) : (
            <>
              {dialogState.title && (
                <DialogHeader>
                  <DialogTitle>{dialogState.title}</DialogTitle>
                  {dialogState.description && (
                    <DialogDescription>{dialogState.description}</DialogDescription>
                  )}
                </DialogHeader>
              )}

              {(dialogState.onConfirm || dialogState.onCancel) && (
                <DialogFooter>
                  {dialogState.onCancel && (
                    <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                      {dialogState.cancelText}
                    </Button>
                  )}
                  {dialogState.onConfirm && (
                    <Button
                      variant={dialogState.variant === "destructive" ? "destructive" : "default"}
                      onClick={handleConfirm}
                      disabled={isLoading}
                    >
                      {isLoading ? "処理中..." : dialogState.confirmText}
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}
