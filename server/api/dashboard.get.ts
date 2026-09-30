import { and, desc, eq, inArray, or, type SQL } from "drizzle-orm";
import {
  content,
  contentType,
  campaign,
  campaignMembership,
  groupMembership,
  resource,
} from "../database/schema";
import { requireAuthenticatedUser } from "../utils/auth";
import {
  CHARACTER_CATEGORIES,
  NON_CHARACTER_CATEGORIES,
} from "../../shared/content-categories";
import { useDatabase } from "../utils/database";

const RECENT_LIMIT = 5;

defineRouteMeta({
  openAPI: {
    tags: ["Dashboard"],
    summary: "Recently updated items for the current user",
    description:
      "Campaigns the user or their groups own or that the user is a member of, and characters/content owned by the user or their groups. Public or merely shared resources are excluded.",
    responses: {
      200: { description: "Recent campaigns, characters, and content" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  const database = useDatabase();

  const [groups, campaigns] = await Promise.all([
    database
      .select({ groupId: groupMembership.groupId })
      .from(groupMembership)
      .where(eq(groupMembership.userId, user.id)),
    database
      .select({ campaignId: campaignMembership.campaignId })
      .from(campaignMembership)
      .where(eq(campaignMembership.userId, user.id)),
  ]);
  const groupIds = groups.map(({ groupId }) => groupId);
  const campaignIds = campaigns.map(({ campaignId }) => campaignId);

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
          inArray(
            contentType.contentCategory,
            isCharacter ? CHARACTER_CATEGORIES : NON_CHARACTER_CATEGORIES,
          ),
        ),
      )
      .orderBy(desc(resource.updatedAt))
      .limit(RECENT_LIMIT);

  const [recentCampaigns, characters, otherContent] = await Promise.all([
    database
      .select(summary)
      .from(campaign)
      .innerJoin(resource, eq(resource.id, campaign.resourceId))
      .where(
        campaignIds.length
          ? or(isOwned, inArray(campaign.resourceId, campaignIds))
          : isOwned,
      )
      .orderBy(desc(resource.updatedAt))
      .limit(RECENT_LIMIT),
    recentContent(true),
    recentContent(false),
  ]);

  return {
    campaigns: recentCampaigns,
    characters,
    content: otherContent,
  };
});
