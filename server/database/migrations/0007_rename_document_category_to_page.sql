-- Hand-written: renames the enum value in place, so Content Types in the
-- "document" category keep their category (now "page"). A generated
-- migration would drop and recreate the enum and cast, which fails for rows
-- holding the old value.
ALTER TYPE "public"."content_category" RENAME VALUE 'document' TO 'page';
