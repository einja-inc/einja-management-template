import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./db/schema.ts",
	out: "./db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		// Use DIRECT_URL when available (Neon pooler URLs break migration
		// advisory locks). Fall back to DATABASE_URL for non-Neon environments.
		url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
	},
	verbose: true,
	strict: true,
});
