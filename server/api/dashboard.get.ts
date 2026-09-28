import { and, desc, eq, inArray, ne, or, type SQL } from "drizzle-orm";
import {
  content,
  contentType,
  game,
  gameMembership,
  groupMembership,
  resource,
} from "../database/schema";
import { requireAuthenticatedUser } from "../utils/auth";
import { useDatabase } from "../utils/database";

const RECENT_LIMIT = 5;

defineRouteMeta({
  openAPI: {
    tags: ["Dashboard"],
    summary: "Recently updated items for the current user",
    description:
      "Games the user or their Groups own or that the user is a member of, and Characters/Content owned by the user or their Groups. Public or merely shared Resources are excluded.",
    responses: {
      200: { description: "Recent Games, Characters, and Content" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const database = useDatabase();

  const [groups, games] = await Promise.all([
    database
      .select({ groupId: groupMembership.groupId })
      .from(groupMembership)
      .where(eq(groupMembership.userId, user.id)),
    database
      .select({ gameId: gameMembership.gameId })
      .from(gameMembership)
      .where(eq(gameMembership.userId, user.id)),
  ]);
  const groupIds = groups.map(({ groupId }) => groupId);
  const gameIds = games.map(({ gameId }) => gameId);

  // Owned by the user directly or by one of their Groups.
  const ownedConditions: SQL[] = [eq(resource.ownerUserId, user.id)];
  if (groupIds.length)
    ownedConditions.push(inArray(resource.ownerGroupId, groupIds));
  const isOwned = or(...ownedConditions)!;

  const summary = {
    id: resource.id,
    name: resource.name,
    updatedAt: resource.updatedAt,
  };

  const recentContent = (isCharacter: boolean) =>
    database
      .select(summary)
      .from(content)
      .innerJoin(resource, eq(resource.id, content.resourceId))
      .innerJoin(contentType, eq(contentType.resourceId, content.contentTypeId))
      .where(
        and(
          isOwned,
          isCharacter
            ? eq(contentType.contentCategory, "playerCharacter")
            : ne(contentType.contentCategory, "playerCharacter"),
        ),
      )
      .orderBy(desc(resource.updatedAt))
      .limit(RECENT_LIMIT);

  const [recentGames, characters, otherContent] = await Promise.all([
    database
      .select(summary)
      .from(game)
      .innerJoin(resource, eq(resource.id, game.resourceId))
      .where(
        gameIds.length
          ? or(isOwned, inArray(game.resourceId, gameIds))
          : isOwned,
      )
      .orderBy(desc(resource.updatedAt))
      .limit(RECENT_LIMIT),
    recentContent(true),
    recentContent(false),
  ]);

  return {
    games: recentGames,
    characters,
    content: otherContent,
  };
});
