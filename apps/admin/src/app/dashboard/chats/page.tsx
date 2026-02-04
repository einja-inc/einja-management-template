import type { Metadata } from "next";
import { ChatsPage } from "./_components/chats-page";

export const metadata: Metadata = {
  title: "Chats",
};

export default function Page() {
  return <ChatsPage />;
}
