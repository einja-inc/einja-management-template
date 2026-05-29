import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { Client } from "pg";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("DATABASE_URL is not set");
	}

	const masked = connectionString.replace(/:[^:@]+@/, ":***@");
	console.log(`Applying migrations to ${masked}`);

	const client = new Client({ connectionString });
	await client.connect();
	try {
		const db = drizzle(client);
		await migrate(db, {
			migrationsFolder: path.join(__dirname, "migrations"),
		});
		console.log("Migrations applied successfully.");
	} finally {
		await client.end();
	}
}

main().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
