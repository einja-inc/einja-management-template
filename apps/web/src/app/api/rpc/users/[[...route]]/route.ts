import { userRoutes } from "@web/server/presentation/routes/userRoutes";
import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono().basePath("/api/rpc/users");
const routes = app.route("/", userRoutes);

export type UsersAppType = typeof routes;

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
