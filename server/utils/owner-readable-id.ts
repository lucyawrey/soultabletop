import { eq } from "drizzle-orm";
import { ownerReadableId } from "../database/schema";
import { useDatabase } from "./database";

// Whether a username or group readable ID is taken by any user or group: they
// share one namespace (`owner_readable_id`, kept by database triggers, which
// stay the authority: a write that races past this check still fails with a
// unique violation). `readableId` is compared lowercase.
export async function isOwnerReadableIdTaken(readableId: string) {
  const [row] = await useDatabase()
    .select({ readableId: ownerReadableId.readableId })
    .from(ownerReadableId)
    .where(eq(ownerReadableId.readableId, readableId.toLowerCase()))
    .limit(1);
  return !!row;
}
