"use client";

import { cn } from "@repo/admin-ui/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/admin-ui/ui/avatar";
import { ScrollArea } from "@repo/admin-ui/ui/scroll-area";
import { Separator } from "@repo/admin-ui/ui/separator";
import { Search as SearchIcon } from "lucide-react";
import { Fragment } from "react";
import type { ChatUser } from "@/data/chats";

interface ChatListProps {
  filteredChatList: ChatUser[];
  selectedUser: ChatUser | null;
  search: string;
  onSearchChange: (search: string) => void;
  onSelectUser: (user: ChatUser) => void;
}

export function ChatList({
  filteredChatList,
  selectedUser,
  search,
  onSearchChange,
  onSelectUser,
}: ChatListProps) {
  return (
    <>
      <label
        className={cn(
          "focus-within:ring-1 focus-within:ring-ring focus-within:outline-hidden",
          "flex h-10 w-full items-center space-x-0 rounded-md border border-border ps-2"
        )}
      >
        <SearchIcon size={15} className="me-2 stroke-slate-500" />
        <span className="sr-only">Search</span>
        <input
          type="text"
          className="w-full flex-1 bg-inherit text-sm focus-visible:outline-hidden"
          placeholder="Search chat..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </label>

      <ScrollArea className="-mx-3 h-full overflow-scroll p-3">
        {filteredChatList.map((chatUsr) => {
          const { id, profile, username, messages, fullName } = chatUsr;
          const lastConvo = messages[0];
          const lastMsg =
            lastConvo.sender === "You" ? `You: ${lastConvo.message}` : lastConvo.message;
          return (
            <Fragment key={id}>
              <button
                type="button"
                className={cn(
                  "group hover:bg-accent hover:text-accent-foreground",
                  "flex w-full rounded-md px-2 py-2 text-start text-sm",
                  selectedUser?.id === id && "sm:bg-muted"
                )}
                onClick={() => onSelectUser(chatUsr)}
              >
                <div className="flex gap-2">
                  <Avatar>
                    <AvatarImage src={profile} alt={username} />
                    <AvatarFallback>{username}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="col-start-2 row-span-2 font-medium">{fullName}</span>
                    <span className="col-start-2 row-span-2 row-start-2 line-clamp-2 text-ellipsis text-muted-foreground group-hover:text-accent-foreground/90">
                      {lastMsg}
                    </span>
                  </div>
                </div>
              </button>
              <Separator className="my-1" />
            </Fragment>
          );
        })}
      </ScrollArea>
    </>
  );
}
