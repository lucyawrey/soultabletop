CREATE TYPE "public"."content_category" AS ENUM('General', 'NonPlayerCharacter', 'Document', 'PlayerCharacter');--> statement-breakpoint
CREATE TYPE "public"."game_audience" AS ENUM('members', 'GMs');--> statement-breakpoint
CREATE TYPE "public"."game_role" AS ENUM('GM', 'Player');--> statement-breakpoint
CREATE TYPE "public"."group_kind" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('admin', 'editor', 'member');--> statement-breakpoint
CREATE TYPE "public"."resource_kind" AS ENUM('system', 'game', 'contentType', 'sheet', 'content');--> statement-breakpoint
CREATE TYPE "public"."share_permission" AS ENUM('read', 'edit');--> statement-breakpoint
CREATE TYPE "public"."site_role" AS ENUM('Member', 'Admin');--> statement-breakpoint
CREATE TABLE "content_type" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"system_id" uuid NOT NULL,
	"content_category" "content_category" DEFAULT 'General' NOT NULL,
	"has_strict_schema" boolean DEFAULT false NOT NULL,
	"schema" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"system_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_membership" (
	"game_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "game_role" DEFAULT 'Player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_membership_game_id_user_id_pk" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" "group_kind" DEFAULT 'user' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_slug_format_check" CHECK ("group"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "group_membership" (
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "group_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_membership_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "resource_kind" NOT NULL,
	"owner_user_id" text,
	"owner_group_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_publicly_readable" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"is_admin_hidden" boolean DEFAULT false NOT NULL,
	"moderation_reason" text,
	"moderated_at" timestamp with time zone,
	"moderated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_exactly_one_owner_check" CHECK (num_nonnulls("resource"."owner_user_id", "resource"."owner_group_id") = 1),
	CONSTRAINT "resource_slug_format_check" CHECK ("resource"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "resource_moderation_metadata_check" CHECK (("resource"."is_admin_hidden" = false AND "resource"."moderation_reason" IS NULL AND "resource"."moderated_at" IS NULL AND "resource"."moderated_by_user_id" IS NULL) OR ("resource"."is_admin_hidden" = true AND "resource"."moderation_reason" IS NOT NULL AND "resource"."moderated_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "resource_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"permission" "share_permission" DEFAULT 'read' NOT NULL,
	"user_id" text,
	"group_id" uuid,
	"game_id" uuid,
	"game_audience" "game_audience",
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_grant_exactly_one_target_check" CHECK (num_nonnulls("resource_grant"."user_id", "resource_grant"."group_id", "resource_grant"."game_id") = 1),
	CONSTRAINT "resource_grant_game_audience_check" CHECK (("resource_grant"."game_id" IS NULL AND "resource_grant"."game_audience" IS NULL) OR ("resource_grant"."game_id" IS NOT NULL AND "resource_grant"."game_audience" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sheet" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"content_type_id" uuid NOT NULL,
	"css_styles" text DEFAULT '' NOT NULL,
	"markup" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system" (
	"resource_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "site_role" DEFAULT 'Member' NOT NULL,
	"slug" text NOT NULL,
	"slug_is_user_chosen" boolean DEFAULT false NOT NULL,
	"icon_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_slug_format_check" CHECK ("user_profile"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
DROP TABLE "content";--> statement-breakpoint
CREATE TABLE "content" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"content_type_id" uuid NOT NULL,
	"sheet_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);--> statement-breakpoint
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_system_id_system_resource_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_system_id_system_resource_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_membership" ADD CONSTRAINT "game_membership_game_id_game_resource_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("resource_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_membership" ADD CONSTRAINT "game_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_owner_group_id_group_id_fk" FOREIGN KEY ("owner_group_id") REFERENCES "public"."group"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_moderated_by_user_id_user_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_game_id_game_resource_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("resource_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet" ADD CONSTRAINT "sheet_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet" ADD CONSTRAINT "sheet_content_type_id_content_type_resource_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_type"("resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system" ADD CONSTRAINT "system_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_membership_user_id_idx" ON "game_membership" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_slug_unique" ON "group" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "group_membership_user_id_idx" ON "group_membership" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_user_slug_kind_unique" ON "resource" USING btree ("owner_user_id","kind",lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "resource_group_slug_kind_unique" ON "resource" USING btree ("owner_group_id","kind",lower("slug"));--> statement-breakpoint
CREATE INDEX "resource_owner_user_id_idx" ON "resource" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "resource_owner_group_id_idx" ON "resource" USING btree ("owner_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grant_user_unique" ON "resource_grant" USING btree ("resource_id","user_id") WHERE "resource_grant"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grant_group_unique" ON "resource_grant" USING btree ("resource_id","group_id") WHERE "resource_grant"."group_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grant_game_unique" ON "resource_grant" USING btree ("resource_id","game_id") WHERE "resource_grant"."game_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "resource_grant_resource_id_idx" ON "resource_grant" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_grant_user_id_idx" ON "resource_grant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resource_grant_group_id_idx" ON "resource_grant" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "resource_grant_game_id_idx" ON "resource_grant" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "sheet_content_type_id_idx" ON "sheet" USING btree ("content_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sheet_default_per_content_type_unique" ON "sheet" USING btree ("content_type_id") WHERE "sheet"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_slug_unique" ON "user_profile" USING btree (lower("slug"));--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_content_type_id_content_type_resource_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_type"("resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_sheet_id_sheet_resource_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheet"("resource_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_content_type_id_idx" ON "content" USING btree ("content_type_id");--> statement-breakpoint
CREATE INDEX "content_sheet_id_idx" ON "content" USING btree ("sheet_id");--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "group" ("name", "slug", "kind") VALUES ('Official', 'official', 'system');