-- Hand-written, data only: the seeded system group ("Official") becomes
-- "Soul Tabletop" with slug `soul`. A regular group already using that slug
-- (the prototype's test group) moves to `soul-test` first.
UPDATE "group" SET "name" = 'Soul Tabletop (Test)', "slug" = 'soul-test' WHERE lower("slug") = 'soul' AND "kind" = 'user';--> statement-breakpoint
UPDATE "group" SET "name" = 'Soul Tabletop', "slug" = 'soul' WHERE "slug" = 'official' AND "kind" = 'system';
