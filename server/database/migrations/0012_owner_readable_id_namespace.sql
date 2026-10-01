CREATE TABLE "owner_readable_id" (
	"readable_id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"group_id" uuid,
	CONSTRAINT "owner_readable_id_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "owner_readable_id_group_id_unique" UNIQUE("group_id"),
	CONSTRAINT "owner_readable_id_exactly_one_owner_check" CHECK (num_nonnulls("owner_readable_id"."user_id", "owner_readable_id"."group_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "owner_readable_id" ADD CONSTRAINT "owner_readable_id_user_id_user_profile_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_readable_id" ADD CONSTRAINT "owner_readable_id_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Hand-written below (drizzle-kit doesn't model triggers). Usernames and group
-- readable IDs share one namespace: fill the table from both, which fails here
-- if any username equals a group readable ID (resolve those by hand first).
INSERT INTO "owner_readable_id" ("readable_id", "user_id")
  SELECT lower("username"), "user_id" FROM "user_profile";--> statement-breakpoint
INSERT INTO "owner_readable_id" ("readable_id", "group_id")
  SELECT lower("readable_id"), "id" FROM "group";--> statement-breakpoint
-- Keep it in step on insert and rename. A name the other table already has
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
  FOR EACH ROW EXECUTE FUNCTION "group_owner_readable_id"();
