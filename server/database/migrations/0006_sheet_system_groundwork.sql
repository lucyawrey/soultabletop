-- `name` is now a built-in field of every ContentType, stored as the resource name.
UPDATE "content_type" SET "schema" = "schema" - 'name' WHERE "schema" ? 'name';--> statement-breakpoint
UPDATE "resource" SET "name" = trim("content"."data"->>'name') FROM "content" WHERE "content"."resource_id" = "resource"."id" AND jsonb_typeof("content"."data"->'name') = 'string' AND trim("content"."data"->>'name') <> '';--> statement-breakpoint
UPDATE "content" SET "data" = "data" - 'name' WHERE "data" ? 'name';--> statement-breakpoint
-- jsonb reorders object keys; json keeps field order as written.
ALTER TABLE "content_type" ALTER COLUMN "schema" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "content_type" ALTER COLUMN "schema" SET DATA TYPE json USING "schema"::json;--> statement-breakpoint
ALTER TABLE "content_type" ALTER COLUMN "schema" SET DEFAULT '{}'::json;--> statement-breakpoint
ALTER TABLE "sheet" ADD COLUMN "default_edit_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sheet" ADD COLUMN "default_autosave" boolean DEFAULT false NOT NULL;
