import type { UsersAppType } from "@/app/api/rpc/users/[[...route]]/route";
import { hc } from "hono/client";

const client = hc<UsersAppType>("/");

export const rpc = {
  users: client.api.rpc.users,
} as const;
