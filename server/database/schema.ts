import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  check,
  index,
  pgEnum,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const siteRole = pgEnum("site_role", ["Member", "Admin"]);
export const groupRole = pgEnum("group_role", ["admin", "editor", "member"]);
export const gameRole = pgEnum("game_role", ["GM", "Player"]);
export const contentCategory = pgEnum("content_category", [
  "General",
  "NonPlayerCharacter",
  "Document",
  "PlayerCharacter",
]);
export const resourceKind = pgEnum("resource_kind", [
  "system",
  "game",
  "contentType",
  "sheet",
  "content",
]);
export const sharePermission = pgEnum("share_permission", ["read", "edit"]);
export const gameAudience = pgEnum("game_audience", ["members", "GMs"]);
export const groupKind = pgEnum("group_kind", ["user", "system"]);

export type ContentFieldSchema =
  | { type: "string" | "number" | "boolean" | "any"; required: boolean }
  | { type: "array"; itemType: ContentFieldSchema; required: boolean }
  | {
      type: "object";
      entries: Record<string, ContentFieldSchema>;
      required: boolean;
    }
  | { type: "localType"; key: string; required: boolean }
  | { type: "resourceRef"; required: boolean }
  | { type: "contentType"; resourceId: string; required: boolean };

export type ContentTypeSchema = Record<string, ContentFieldSchema>;

export const userProfile = pgTable(
  "user_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    role: siteRole("role").default("Member").notNull(),
    slug: text("slug").notNull(),
    iconImageUrl: text("icon_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_profile_slug_unique").on(sql`lower(${table.slug})`),
    check(
      "user_profile_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const group = pgTable(
  "group",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    kind: groupKind("kind").default("user").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("group_slug_unique").on(sql`lower(${table.slug})`),
    check(
      "group_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const groupMembership = pgTable(
  "group_membership",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: groupRole("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("group_membership_user_id_idx").on(table.userId),
  ],
);

export const resource = pgTable(
  "resource",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: resourceKind("kind").notNull(),
    ownerUserId: text("owner_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    ownerGroupId: uuid("owner_group_id").references(() => group.id, {
      onDelete: "restrict",
    }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    isPubliclyReadable: boolean("is_publicly_readable")
      .default(false)
      .notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    isAdminHidden: boolean("is_admin_hidden").default(false).notNull(),
    moderationReason: text("moderation_reason"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderatedByUserId: text("moderated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "resource_exactly_one_owner_check",
      sql`num_nonnulls(${table.ownerUserId}, ${table.ownerGroupId}) = 1`,
    ),
    check(
      "resource_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check(
      "resource_moderation_metadata_check",
      sql`(${table.isAdminHidden} = false AND ${table.moderationReason} IS NULL AND ${table.moderatedAt} IS NULL AND ${table.moderatedByUserId} IS NULL) OR (${table.isAdminHidden} = true AND ${table.moderationReason} IS NOT NULL AND ${table.moderatedAt} IS NOT NULL)`,
    ),
    uniqueIndex("resource_user_slug_kind_unique").on(
      table.ownerUserId,
      table.kind,
      sql`lower(${table.slug})`,
    ),
    uniqueIndex("resource_group_slug_kind_unique").on(
      table.ownerGroupId,
      table.kind,
      sql`lower(${table.slug})`,
    ),
    index("resource_owner_user_id_idx").on(table.ownerUserId),
    index("resource_owner_group_id_idx").on(table.ownerGroupId),
  ],
);

export const resourceGrant = pgTable(
  "resource_grant",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
    permission: sharePermission("permission").default("read").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    groupId: uuid("group_id").references(() => group.id, {
      onDelete: "cascade",
    }),
    gameId: uuid("game_id").references(() => game.resourceId, {
      onDelete: "cascade",
    }),
    gameAudience: gameAudience("game_audience"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "resource_grant_exactly_one_target_check",
      sql`num_nonnulls(${table.userId}, ${table.groupId}, ${table.gameId}) = 1`,
    ),
    check(
      "resource_grant_game_audience_check",
      sql`(${table.gameId} IS NULL AND ${table.gameAudience} IS NULL) OR (${table.gameId} IS NOT NULL AND ${table.gameAudience} IS NOT NULL)`,
    ),
    uniqueIndex("resource_grant_user_unique")
      .on(table.resourceId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex("resource_grant_group_unique")
      .on(table.resourceId, table.groupId)
      .where(sql`${table.groupId} IS NOT NULL`),
    uniqueIndex("resource_grant_game_unique")
      .on(table.resourceId, table.gameId)
      .where(sql`${table.gameId} IS NOT NULL`),
    index("resource_grant_resource_id_idx").on(table.resourceId),
    index("resource_grant_user_id_idx").on(table.userId),
    index("resource_grant_group_id_idx").on(table.groupId),
    index("resource_grant_game_id_idx").on(table.gameId),
  ],
);

export const system = pgTable("system", {
  resourceId: uuid("resource_id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
});

export const game = pgTable("game", {
  resourceId: uuid("resource_id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.resourceId, { onDelete: "restrict" }),
});

export const gameMembership = pgTable(
  "game_membership",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.resourceId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: gameRole("role").default("Player").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.userId] }),
    index("game_membership_user_id_idx").on(table.userId),
  ],
);

export const contentType = pgTable("content_type", {
  resourceId: uuid("resource_id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.resourceId, { onDelete: "restrict" }),
  contentCategory: contentCategory("content_category")
    .default("General")
    .notNull(),
  hasStrictSchema: boolean("has_strict_schema").default(false).notNull(),
  schema: jsonb("schema")
    .$type<ContentTypeSchema>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
});

export const sheet = pgTable(
  "sheet",
  {
    resourceId: uuid("resource_id")
      .primaryKey()
      .references(() => resource.id, { onDelete: "cascade" }),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentType.resourceId, { onDelete: "restrict" }),
    cssStyles: text("css_styles").default("").notNull(),
    markup: text("markup").default("").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
  },
  (table) => [
    index("sheet_content_type_id_idx").on(table.contentTypeId),
    uniqueIndex("sheet_default_per_content_type_unique")
      .on(table.contentTypeId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export const content = pgTable(
  "content",
  {
    resourceId: uuid("resource_id")
      .primaryKey()
      .references(() => resource.id, { onDelete: "cascade" }),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentType.resourceId, { onDelete: "restrict" }),
    sheetId: uuid("sheet_id").references(() => sheet.resourceId, {
      onDelete: "set null",
    }),
    data: jsonb("data")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => [
    index("content_content_type_id_idx").on(table.contentTypeId),
    index("content_sheet_id_idx").on(table.sheetId),
  ],
);

export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;
export type Group = typeof group.$inferSelect;
export type NewGroup = typeof group.$inferInsert;
export type Resource = typeof resource.$inferSelect;
export type NewResource = typeof resource.$inferInsert;
export type ResourceGrant = typeof resourceGrant.$inferSelect;
export type NewResourceGrant = typeof resourceGrant.$inferInsert;
export type System = typeof system.$inferSelect;
export type NewSystem = typeof system.$inferInsert;
export type Game = typeof game.$inferSelect;
export type NewGame = typeof game.$inferInsert;
export type ContentType = typeof contentType.$inferSelect;
export type NewContentType = typeof contentType.$inferInsert;
export type Sheet = typeof sheet.$inferSelect;
export type NewSheet = typeof sheet.$inferInsert;
export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;
