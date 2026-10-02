-- Campaign creators are GMs by default (campaign create now adds them). Backfill
-- existing campaigns: the creator becomes a GM member unless they're already a
-- member (an existing role is kept). Campaigns whose creator was deleted get none.
INSERT INTO "campaign_membership" ("campaign_id", "user_id", "role")
SELECT "campaign"."resource_id", "resource"."created_by_user_id", 'gm'
FROM "campaign"
INNER JOIN "resource" ON "resource"."id" = "campaign"."resource_id"
WHERE "resource"."created_by_user_id" IS NOT NULL
ON CONFLICT ("campaign_id", "user_id") DO NOTHING;
