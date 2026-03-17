import { defineConfig } from "prisma/config";

const prismaCliUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(prismaCliUrl ? { datasource: { url: prismaCliUrl } } : {}),
  migrations: {
    seed: "npx dotenvx run -o -f ../../.env -- tsx prisma/seed.ts",
  },
});
