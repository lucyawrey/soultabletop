import { MikroORM, PostgreSqlDriver } from "@mikro-orm/postgresql";

let ormPromise: Promise<MikroORM> | undefined;

export function useDatabase() {
  const databaseUrl =
    useRuntimeConfig().databaseUrl || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to the database.");
  }

  ormPromise ??= MikroORM.init({
    driver: PostgreSqlDriver,
    clientUrl: databaseUrl,
    driverOptions: {
      ssl: true,
    },
    entities: [],
    discovery: {
      warnWhenNoEntities: false,
    },
  });

  return ormPromise;
}
