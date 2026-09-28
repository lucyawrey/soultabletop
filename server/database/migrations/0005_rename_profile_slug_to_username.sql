-- Hand-written: a pure rename, so existing usernames are preserved. The
-- lower(...) index expression and check constraint follow the column
-- automatically; only their names change.
ALTER TABLE "user_profile" RENAME COLUMN "slug" TO "username";--> statement-breakpoint
ALTER INDEX "user_profile_slug_unique" RENAME TO "user_profile_username_unique";--> statement-breakpoint
ALTER TABLE "user_profile" RENAME CONSTRAINT "user_profile_slug_format_check" TO "user_profile_username_format_check";
