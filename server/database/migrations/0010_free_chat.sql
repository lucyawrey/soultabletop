CREATE TYPE "public"."sheet_display" AS ENUM('text', 'box');--> statement-breakpoint
ALTER TABLE "sheet" ADD COLUMN "default_display" "sheet_display" DEFAULT 'text' NOT NULL;