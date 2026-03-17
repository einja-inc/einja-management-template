import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "npx dotenvx run -o -f ../../.env -- tsx prisma/seed.ts",
  },
});
