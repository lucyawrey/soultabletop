-- Hand-written: renames in place so existing rows keep their data. A generated
-- migration would drop and recreate the renamed columns, tables, and enum
-- values.

-- Game → Campaign
ALTER TYPE "public"."resource_kind" RENAME VALUE 'game' TO 'campaign';--> statement-breakpoint
ALTER TYPE "public"."game_role" RENAME TO "campaign_role";--> statement-breakpoint
ALTER TYPE "public"."game_audience" RENAME TO "campaign_audience";--> statement-breakpoint
ALTER TABLE "game" RENAME TO "campaign";--> statement-breakpoint
ALTER TABLE "campaign" RENAME CONSTRAINT "game_pkey" TO "campaign_pkey";--> statement-breakpoint
ALTER TABLE "campaign" RENAME CONSTRAINT "game_resource_id_resource_id_fk" TO "campaign_resource_id_resource_id_fk";--> statement-breakpoint
ALTER TABLE "campaign" RENAME CONSTRAINT "game_system_id_system_resource_id_fk" TO "campaign_system_id_system_resource_id_fk";--> statement-breakpoint
ALTER TABLE "game_membership" RENAME TO "campaign_membership";--> statement-breakpoint
ALTER TABLE "campaign_membership" RENAME COLUMN "game_id" TO "campaign_id";--> statement-breakpoint
ALTER TABLE "campaign_membership" RENAME CONSTRAINT "game_membership_game_id_user_id_pk" TO "campaign_membership_campaign_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "campaign_membership" RENAME CONSTRAINT "game_membership_game_id_game_resource_id_fk" TO "campaign_membership_campaign_id_campaign_resource_id_fk";--> statement-breakpoint
ALTER TABLE "campaign_membership" RENAME CONSTRAINT "game_membership_user_id_user_id_fk" TO "campaign_membership_user_id_user_id_fk";--> statement-breakpoint
ALTER INDEX "game_membership_user_id_idx" RENAME TO "campaign_membership_user_id_idx";--> statement-breakpoint
ALTER TABLE "resource_grant" RENAME COLUMN "game_id" TO "campaign_id";--> statement-breakpoint
ALTER TABLE "resource_grant" RENAME COLUMN "game_audience" TO "campaign_audience";--> statement-breakpoint
ALTER TABLE "resource_grant" RENAME CONSTRAINT "resource_grant_game_id_game_resource_id_fk" TO "resource_grant_campaign_id_campaign_resource_id_fk";--> statement-breakpoint
ALTER TABLE "resource_grant" RENAME CONSTRAINT "resource_grant_game_audience_check" TO "resource_grant_campaign_audience_check";--> statement-breakpoint
ALTER INDEX "resource_grant_game_unique" RENAME TO "resource_grant_campaign_unique";--> statement-breakpoint
ALTER INDEX "resource_grant_game_id_idx" RENAME TO "resource_grant_campaign_id_idx";--> statement-breakpoint
-- resourceLink fields restricted to kind "game" now name "campaign".
UPDATE "content_type" SET "schema" = regexp_replace("schema"::text, '"kind"\s*:\s*"game"', '"kind":"campaign"', 'g')::json WHERE "schema"::text ~ '"kind"\s*:\s*"game"';--> statement-breakpoint

-- slug → readable_id
ALTER TABLE "group" RENAME COLUMN "slug" TO "readable_id";--> statement-breakpoint
ALTER TABLE "group" RENAME CONSTRAINT "group_slug_format_check" TO "group_readable_id_format_check";--> statement-breakpoint
ALTER INDEX "group_slug_unique" RENAME TO "group_readable_id_unique";--> statement-breakpoint
ALTER TABLE "resource" RENAME COLUMN "slug" TO "readable_id";--> statement-breakpoint
ALTER TABLE "resource" RENAME CONSTRAINT "resource_slug_format_check" TO "resource_readable_id_format_check";--> statement-breakpoint
ALTER INDEX "resource_user_slug_kind_unique" RENAME TO "resource_user_readable_id_kind_unique";--> statement-breakpoint
ALTER INDEX "resource_group_slug_kind_unique" RENAME TO "resource_group_readable_id_kind_unique";
