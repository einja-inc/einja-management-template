import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

// Use standard pg (node-postgres) for local PostgreSQL (localhost/127.0.0.1),
// and @neondatabase/serverless for Neon production endpoints.
// Local PostgreSQL does not support WebSocket connections required by Neon serverless.
const isNeon =
	connectionString.includes("neon.tech") ||
	connectionString.includes("neon.database");

type AnyPool = import("pg").Pool | import("@neondatabase/serverless").Pool;
type AnyDrizzle =
	| ReturnType<typeof import("drizzle-orm/node-postgres").drizzle>
	| ReturnType<typeof import("drizzle-orm/neon-serverless").drizzle>;

const globalForDb = globalThis as unknown as {
	__einjaDbPool?: AnyPool;
	__einjaDb?: AnyDrizzle;
};

function createDb(): { pool: AnyPool; db: AnyDrizzle } {
	if (isNeon) {
		const { neonConfig, Pool } = require("@neondatabase/serverless") as typeof import("@neondatabase/serverless");
		const { drizzle } = require("drizzle-orm/neon-serverless") as typeof import("drizzle-orm/neon-serverless");
		if (typeof (globalThis as Record<string, unknown>).EdgeRuntime === "undefined") {
			const wsModule = require("ws") as typeof import("ws");
			neonConfig.webSocketConstructor = (wsModule.default ?? wsModule) as unknown as typeof WebSocket;
		}
		const pool = new Pool({ connectionString });
		return { pool, db: drizzle(pool, { schema }) };
	} else {
		const { Pool } = require("pg") as typeof import("pg");
		const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
		const pool = new Pool({ connectionString });
		return { pool, db: drizzle(pool, { schema }) as unknown as AnyDrizzle };
	}
}

const instance = globalForDb.__einjaDb
	? { pool: globalForDb.__einjaDbPool as AnyPool, db: globalForDb.__einjaDb }
	: createDb();

export const pool = instance.pool;
export const db = instance.db;

if (process.env.NODE_ENV !== "production") {
	globalForDb.__einjaDbPool = pool;
	globalForDb.__einjaDb = db;
}
