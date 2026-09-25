import { asc } from "drizzle-orm";
import { content } from "../../database/schema";
import { useDatabase } from "../../utils/database";

export default defineEventHandler(async () => {
  const database = useDatabase();
  return database.select().from(content).orderBy(asc(content.createdAt));
});
