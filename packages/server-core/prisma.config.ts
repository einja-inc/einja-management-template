import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "npx dotenvx run -f ../../.env.example -- tsx prisma/seed.ts",
  },
});
