"use client";

import type { ChatUser } from "@/data/chats";
import { conversations } from "@/data/chats";
import { Header } from "@repo/admin-ui/layout";
import { Main } from "@repo/admin-ui/layout";
import { Button } from "@repo/admin-ui/ui/button";
import { Edit, MessagesSquare } from "lucide-react";
import { useState } from "react";
import { ChatList } from "./chat-list";
import { ChatMessages } from "./chat-messages";
import { NewChat } from "./new-chat";

export function ChatsPage() {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [mobileSelectedUser, setMobileSelectedUser] = useState<ChatUser | null>(null);
  const [createConversationDialogOpened, setCreateConversationDialog] = useState(false);

  // Filtered data based on the search query
  const filteredChatList = conversations.filter(({ fullName }) =>
    fullName.toLowerCase().includes(search.trim().toLowerCase())
  );

  const users = conversations.map(({ messages, ...user }) => user);

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Chats</h1>
          <MessagesSquare size={20} />
        </div>
      </Header>

      <Main fixed>
        <section className="flex h-full gap-6">
          {/* Left Side */}
          <div className="flex w-full flex-col gap-2 sm:w-56 lg:w-72 2xl:w-80">
            <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pb-3 shadow-md sm:static sm:z-auto sm:mx-0 sm:p-0 sm:shadow-none">
              <div className="flex items-center justify-between py-2">
                <div className="flex gap-2">
                  <h2 className="text-xl font-bold">Inbox</h2>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setCreateConversationDialog(true)}
                  className="rounded-lg"
                >
                  <Edit size={24} className="stroke-muted-foreground" />
                </Button>
              </div>
            </div>

            <ChatList
              filteredChatList={filteredChatList}
              selectedUser={selectedUser}
              search={search}
              onSearchChange={setSearch}
              onSelectUser={(user) => {
                setSelectedUser(user);
                setMobileSelectedUser(user);
              }}
            />
          </div>

          {/* Right Side */}
          {selectedUser ? (
            <ChatMessages
              selectedUser={selectedUser}
              mobileSelectedUser={mobileSelectedUser}
              onCloseMobile={() => setMobileSelectedUser(null)}
            />
          ) : (
            <div className="absolute inset-0 start-full z-50 hidden w-full flex-1 flex-col justify-center rounded-md border bg-card shadow-xs sm:static sm:z-auto sm:flex">
              <div className="flex flex-col items-center space-y-6">
                <div className="flex size-16 items-center justify-center rounded-full border-2 border-border">
                  <MessagesSquare className="size-8" />
                </div>
                <div className="space-y-2 text-center">
                  <h2 className="text-xl font-semibold">Your messages</h2>
                  <p className="text-sm text-muted-foreground">Send a message to start a chat.</p>
                </div>
                <Button onClick={() => setCreateConversationDialog(true)}>Send message</Button>
              </div>
            </div>
          )}
        </section>
        <NewChat
          users={users}
          onOpenChange={setCreateConversationDialog}
          open={createConversationDialogOpened}
        />
      </Main>
    </>
  );
}
