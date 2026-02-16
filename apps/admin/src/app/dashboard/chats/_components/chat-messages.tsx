"use client";

import type { ChatUser, Convo } from "@/data/chats";
import { cn } from "@repo/admin-ui/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/admin-ui/ui/avatar";
import { Button } from "@repo/admin-ui/ui/button";
import { format } from "date-fns";
import {
  ArrowLeft,
  ImagePlus,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Send,
  Video,
} from "lucide-react";
import { Fragment, useState } from "react";

interface ChatMessagesProps {
  selectedUser: ChatUser;
  mobileSelectedUser: ChatUser | null;
  onCloseMobile: () => void;
}

export function ChatMessages({
  selectedUser,
  mobileSelectedUser,
  onCloseMobile,
}: ChatMessagesProps) {
  const [messageText, setMessageText] = useState("");

  const currentMessage = selectedUser?.messages.reduce((acc: Record<string, Convo[]>, obj) => {
    const key = format(obj.timestamp, "d MMM, yyyy");

    // Create an array for the category if it doesn't exist
    if (!acc[key]) {
      acc[key] = [];
    }

    // Push the current object to the array
    acc[key].push(obj);

    return acc;
  }, {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // ローカルで処理（APIなし）
    console.log("Send message:", messageText);
    setMessageText("");
  };

  return (
    <div
      className={cn(
        "absolute inset-0 start-full z-[var(--z-mobile-panel)] hidden w-full flex-1 flex-col border bg-background shadow-xs sm:static sm:z-auto sm:flex sm:rounded-md",
        mobileSelectedUser && "start-0 flex"
      )}
    >
      {/* Top Part */}
      <div className="mb-1 flex flex-none justify-between bg-card p-4 shadow-lg sm:rounded-t-md">
        {/* Left */}
        <div className="flex gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="-ms-2 h-full sm:hidden"
            onClick={onCloseMobile}
          >
            <ArrowLeft className="rtl:rotate-180" />
          </Button>
          <div className="flex items-center gap-2 lg:gap-4">
            <Avatar className="size-9 lg:size-11">
              <AvatarImage src={selectedUser.profile} alt={selectedUser.username} />
              <AvatarFallback>{selectedUser.username}</AvatarFallback>
            </Avatar>
            <div>
              <span className="col-start-2 row-span-2 text-sm font-medium lg:text-base">
                {selectedUser.fullName}
              </span>
              <span className="col-start-2 row-span-2 row-start-2 line-clamp-1 block max-w-32 text-xs text-nowrap text-ellipsis text-muted-foreground lg:max-w-none lg:text-sm">
                {selectedUser.title}
              </span>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="-me-1 flex items-center gap-1 lg:gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="hidden size-8 rounded-full sm:inline-flex lg:size-10"
          >
            <Video size={22} className="stroke-muted-foreground" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hidden size-8 rounded-full sm:inline-flex lg:size-10"
          >
            <Phone size={22} className="stroke-muted-foreground" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-10 rounded-md sm:h-8 sm:w-4 lg:h-10 lg:w-6"
          >
            <MoreVertical className="stroke-muted-foreground sm:size-5" />
          </Button>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex flex-1 flex-col gap-2 rounded-md px-4 pt-0 pb-4">
        <div className="flex size-full flex-1">
          <div className="chat-text-container relative -me-4 flex flex-1 flex-col overflow-y-hidden">
            <div className="chat-flex flex h-40 w-full grow flex-col-reverse justify-start gap-4 overflow-y-auto py-2 pe-4 pb-4">
              {currentMessage &&
                Object.keys(currentMessage).map((key) => (
                  <Fragment key={key}>
                    {currentMessage[key].map((msg, index) => (
                      <div
                        key={`${msg.sender}-${msg.timestamp}-${index}`}
                        className={cn(
                          "chat-box max-w-72 px-3 py-2 wrap-break-word shadow-lg",
                          msg.sender === "You"
                            ? "self-end rounded-[16px_16px_0_16px] bg-primary/90 text-primary-foreground/75"
                            : "self-start rounded-[16px_16px_16px_0] bg-muted"
                        )}
                      >
                        {msg.message}{" "}
                        <span
                          className={cn(
                            "mt-1 block text-xs font-light text-foreground/75 italic",
                            msg.sender === "You" && "text-end text-primary-foreground/85"
                          )}
                        >
                          {format(msg.timestamp, "h:mm a")}
                        </span>
                      </div>
                    ))}
                    <div className="text-center text-xs">{key}</div>
                  </Fragment>
                ))}
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex w-full flex-none gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 focus-within:ring-1 focus-within:ring-ring focus-within:outline-hidden lg:gap-4">
            <div className="space-x-1">
              <Button size="icon" type="button" variant="ghost" className="h-8 rounded-md">
                <Plus size={20} className="stroke-muted-foreground" />
              </Button>
              <Button
                size="icon"
                type="button"
                variant="ghost"
                className="hidden h-8 rounded-md lg:inline-flex"
              >
                <ImagePlus size={20} className="stroke-muted-foreground" />
              </Button>
              <Button
                size="icon"
                type="button"
                variant="ghost"
                className="hidden h-8 rounded-md lg:inline-flex"
              >
                <Paperclip size={20} className="stroke-muted-foreground" />
              </Button>
            </div>
            <label className="flex-1">
              <span className="sr-only">Chat Text Box</span>
              <input
                type="text"
                placeholder="Type your messages..."
                className="h-8 w-full bg-inherit focus-visible:outline-hidden"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
            </label>
            <Button variant="ghost" size="icon" type="submit" className="hidden sm:inline-flex">
              <Send size={20} />
            </Button>
          </div>
          <Button type="submit" className="h-full sm:hidden">
            <Send size={18} /> Send
          </Button>
        </form>
      </div>
    </div>
  );
}
