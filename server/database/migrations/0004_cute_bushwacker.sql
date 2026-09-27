ALTER TABLE "content_type" ALTER COLUMN "content_category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "content_type" ALTER COLUMN "content_category" SET DEFAULT 'general'::text;--> statement-breakpoint
UPDATE "content_type" SET "content_category" = CASE "content_category"
  WHEN 'General' THEN 'general'
  WHEN 'NonPlayerCharacter' THEN 'nonPlayerCharacter'
  WHEN 'Document' THEN 'document'
  WHEN 'PlayerCharacter' THEN 'playerCharacter'
  ELSE "content_category"
END;--> statement-breakpoint
DROP TYPE "public"."content_category";--> statement-breakpoint
CREATE TYPE "public"."content_category" AS ENUM('general', 'nonPlayerCharacter', 'document', 'playerCharacter');--> statement-breakpoint
ALTER TABLE "content_type" ALTER COLUMN "content_category" SET DEFAULT 'general'::"public"."content_category";--> statement-breakpoint
ALTER TABLE "content_type" ALTER COLUMN "content_category" SET DATA TYPE "public"."content_category" USING "content_category"::"public"."content_category";--> statement-breakpoint
ALTER TABLE "resource_grant" ALTER COLUMN "game_audience" SET DATA TYPE text;--> statement-breakpoint
UPDATE "resource_grant" SET "game_audience" = CASE "game_audience"
  WHEN 'GMs' THEN 'gms'
  ELSE "game_audience"
END;--> statement-breakpoint
DROP TYPE "public"."game_audience";--> statement-breakpoint
CREATE TYPE "public"."game_audience" AS ENUM('members', 'gms');--> statement-breakpoint
ALTER TABLE "resource_grant" ALTER COLUMN "game_audience" SET DATA TYPE "public"."game_audience" USING "game_audience"::"public"."game_audience";--> statement-breakpoint
ALTER TABLE "game_membership" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "game_membership" ALTER COLUMN "role" SET DEFAULT 'player'::text;--> statement-breakpoint
UPDATE "game_membership" SET "role" = CASE "role"
  WHEN 'GM' THEN 'gm'
  WHEN 'Player' THEN 'player'
  ELSE "role"
END;--> statement-breakpoint
DROP TYPE "public"."game_role";--> statement-breakpoint
CREATE TYPE "public"."game_role" AS ENUM('gm', 'player');--> statement-breakpoint
ALTER TABLE "game_membership" ALTER COLUMN "role" SET DEFAULT 'player'::"public"."game_role";--> statement-breakpoint
ALTER TABLE "game_membership" ALTER COLUMN "role" SET DATA TYPE "public"."game_role" USING "role"::"public"."game_role";--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "role" SET DEFAULT 'member'::text;--> statement-breakpoint
UPDATE "user_profile" SET "role" = CASE "role"
  WHEN 'Member' THEN 'member'
  WHEN 'Admin' THEN 'admin'
  ELSE "role"
END;--> statement-breakpoint
DROP TYPE "public"."site_role";--> statement-breakpoint
CREATE TYPE "public"."site_role" AS ENUM('member', 'admin');--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."site_role";--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "role" SET DATA TYPE "public"."site_role" USING "role"::"public"."site_role";
