import { defineConfig } from "@mikro-orm/postgresql";

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  driverOptions: {
    ssl: true,
  },
  entities: ["./server/database/entities/**/*.ts"],
  migrations: {
    path: "./server/database/migrations",
    pathTs: "./server/database/migrations",
  },
});
