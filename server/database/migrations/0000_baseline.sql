CREATE TYPE "public"."campaign_audience" AS ENUM('members', 'gms');--> statement-breakpoint
CREATE TYPE "public"."campaign_role" AS ENUM('gm', 'player');--> statement-breakpoint
CREATE TYPE "public"."content_category" AS ENUM('general', 'nonPlayerCharacter', 'page', 'playerCharacter');--> statement-breakpoint
CREATE TYPE "public"."group_kind" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('admin', 'editor', 'member');--> statement-breakpoint
CREATE TYPE "public"."resource_kind" AS ENUM('system', 'campaign', 'contentType', 'sheet', 'content');--> statement-breakpoint
CREATE TYPE "public"."share_permission" AS ENUM('read', 'edit');--> statement-breakpoint
CREATE TYPE "public"."sheet_display" AS ENUM('text', 'box');--> statement-breakpoint
CREATE TYPE "public"."site_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"reference_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp with time zone,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"system_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_membership" (
	"campaign_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "campaign_role" DEFAULT 'player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_membership_campaign_id_user_id_pk" PRIMARY KEY("campaign_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "content" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"content_type_id" uuid NOT NULL,
	"sheet_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_type" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"system_id" uuid NOT NULL,
	"content_category" "content_category" DEFAULT 'general' NOT NULL,
	"has_strict_schema" boolean DEFAULT false NOT NULL,
	"show_sheet_warnings" boolean DEFAULT false NOT NULL,
	"schema" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"readable_id" text NOT NULL,
	"kind" "group_kind" DEFAULT 'user' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_readable_id_format_check" CHECK ("group"."readable_id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
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
CREATE TABLE "owner_readable_id" (
	"readable_id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"group_id" uuid,
	CONSTRAINT "owner_readable_id_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "owner_readable_id_group_id_unique" UNIQUE("group_id"),
	CONSTRAINT "owner_readable_id_exactly_one_owner_check" CHECK (num_nonnulls("owner_readable_id"."user_id", "owner_readable_id"."group_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "resource_kind" NOT NULL,
	"owner_user_id" text,
	"owner_group_id" uuid,
	"readable_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
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
	CONSTRAINT "resource_readable_id_format_check" CHECK ("resource"."readable_id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "resource_moderation_metadata_check" CHECK (("resource"."is_admin_hidden" = false AND "resource"."moderation_reason" IS NULL AND "resource"."moderated_at" IS NULL AND "resource"."moderated_by_user_id" IS NULL) OR ("resource"."is_admin_hidden" = true AND "resource"."moderation_reason" IS NOT NULL AND "resource"."moderated_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "resource_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"permission" "share_permission" DEFAULT 'read' NOT NULL,
	"user_id" text,
	"group_id" uuid,
	"campaign_id" uuid,
	"campaign_audience" "campaign_audience",
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_grant_exactly_one_target_check" CHECK (num_nonnulls("resource_grant"."user_id", "resource_grant"."group_id", "resource_grant"."campaign_id") = 1),
	CONSTRAINT "resource_grant_campaign_audience_check" CHECK (("resource_grant"."campaign_id" IS NULL AND "resource_grant"."campaign_audience" IS NULL) OR ("resource_grant"."campaign_id" IS NOT NULL AND "resource_grant"."campaign_audience" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sheet" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"content_type_id" uuid NOT NULL,
	"css_styles" text DEFAULT '' NOT NULL,
	"markup" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"default_edit_mode" boolean DEFAULT false NOT NULL,
	"default_autosave" boolean DEFAULT false NOT NULL,
	"default_display" "sheet_display" DEFAULT 'text' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system" (
	"resource_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "site_role" DEFAULT 'member' NOT NULL,
	"username" text NOT NULL,
	"icon_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_username_format_check" CHECK ("user_profile"."username" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_reference_id_user_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_system_id_system_resource_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_membership" ADD CONSTRAINT "campaign_membership_campaign_id_campaign_resource_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("resource_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_membership" ADD CONSTRAINT "campaign_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_content_type_id_content_type_resource_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_type"("resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_sheet_id_sheet_resource_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheet"("resource_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_system_id_system_resource_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_readable_id" ADD CONSTRAINT "owner_readable_id_user_id_user_profile_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_readable_id" ADD CONSTRAINT "owner_readable_id_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_owner_group_id_group_id_fk" FOREIGN KEY ("owner_group_id") REFERENCES "public"."group"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_moderated_by_user_id_user_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_campaign_id_campaign_resource_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("resource_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet" ADD CONSTRAINT "sheet_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet" ADD CONSTRAINT "sheet_content_type_id_content_type_resource_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_type"("resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system" ADD CONSTRAINT "system_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apikey_key_unique" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "apikey_reference_id_idx" ON "apikey" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "apikey_config_id_idx" ON "apikey" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "campaign_membership_user_id_idx" ON "campaign_membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_content_type_id_idx" ON "content" USING btree ("content_type_id");--> statement-breakpoint
CREATE INDEX "content_sheet_id_idx" ON "content" USING btree ("sheet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_readable_id_unique" ON "group" USING btree (lower("readable_id"));--> statement-breakpoint
CREATE INDEX "group_membership_user_id_idx" ON "group_membership" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_user_readable_id_kind_unique" ON "resource" USING btree ("owner_user_id","kind",lower("readable_id"));--> statement-breakpoint
CREATE UNIQUE INDEX "resource_group_readable_id_kind_unique" ON "resource" USING btree ("owner_group_id","kind",lower("readable_id"));--> statement-breakpoint
CREATE INDEX "resource_owner_user_id_idx" ON "resource" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "resource_owner_group_id_idx" ON "resource" USING btree ("owner_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grant_user_unique" ON "resource_grant" USING btree ("resource_id","user_id") WHERE "resource_grant"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grant_group_unique" ON "resource_grant" USING btree ("resource_id","group_id") WHERE "resource_grant"."group_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grant_campaign_unique" ON "resource_grant" USING btree ("resource_id","campaign_id") WHERE "resource_grant"."campaign_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "resource_grant_resource_id_idx" ON "resource_grant" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_grant_user_id_idx" ON "resource_grant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resource_grant_group_id_idx" ON "resource_grant" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "resource_grant_campaign_id_idx" ON "resource_grant" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "sheet_content_type_id_idx" ON "sheet" USING btree ("content_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sheet_default_per_content_type_unique" ON "sheet" USING btree ("content_type_id") WHERE "sheet"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_username_unique" ON "user_profile" USING btree (lower("username"));--> statement-breakpoint
-- Hand-written below (drizzle-kit doesn't model triggers or seed rows).
-- Usernames and group readable IDs share one namespace in "owner_readable_id",
-- kept in step on insert and rename. A name the other table already has
-- violates the primary key, a unique violation (23505) that routes already
-- answer with 409. Deletes cascade through the foreign keys.
CREATE FUNCTION "user_profile_owner_readable_id"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "owner_readable_id" ("readable_id", "user_id")
    VALUES (lower(NEW."username"), NEW."user_id")
    ON CONFLICT ("user_id") DO UPDATE SET "readable_id" = excluded."readable_id";
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER "user_profile_owner_readable_id"
  AFTER INSERT OR UPDATE OF "username" ON "user_profile"
  FOR EACH ROW EXECUTE FUNCTION "user_profile_owner_readable_id"();--> statement-breakpoint
CREATE FUNCTION "group_owner_readable_id"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "owner_readable_id" ("readable_id", "group_id")
    VALUES (lower(NEW."readable_id"), NEW."id")
    ON CONFLICT ("group_id") DO UPDATE SET "readable_id" = excluded."readable_id";
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER "group_owner_readable_id"
  AFTER INSERT OR UPDATE OF "readable_id" ON "group"
  FOR EACH ROW EXECUTE FUNCTION "group_owner_readable_id"();--> statement-breakpoint
-- The site's system group: resources it owns are Official.
INSERT INTO "group" ("name", "readable_id", "kind") VALUES ('Soul Tabletop', 'soul', 'system');
