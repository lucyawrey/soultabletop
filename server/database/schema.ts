import { sql } from "drizzle-orm";
import type { ContentTypeSchema } from "../../shared/content-schema";
import { CONTENT_CATEGORIES } from "../../shared/content-categories";
import { SHEET_DISPLAYS } from "../../shared/sheet/registry";
import {
  boolean,
  json,
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

export const siteRole = pgEnum("site_role", ["member", "admin"]);
export const groupRole = pgEnum("group_role", ["admin", "editor", "member"]);
export const campaignRole = pgEnum("campaign_role", ["gm", "player"]);
export const contentCategory = pgEnum("content_category", CONTENT_CATEGORIES);
export const sheetDisplay = pgEnum("sheet_display", SHEET_DISPLAYS);
export const resourceKind = pgEnum("resource_kind", [
  "system",
  "campaign",
  "contentType",
  "sheet",
  "content",
]);
export const sharePermission = pgEnum("share_permission", ["read", "edit"]);
export const campaignAudience = pgEnum("campaign_audience", ["members", "gms"]);
export const groupKind = pgEnum("group_kind", ["user", "system"]);

export type {
  ContentFieldSchema,
  ContentTypeSchema,
} from "../../shared/content-schema";

export const userProfile = pgTable(
  "user_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    role: siteRole("role").default("member").notNull(),
    username: text("username").notNull(),
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
    uniqueIndex("user_profile_username_unique").on(sql`lower(${table.username})`),
    check(
      "user_profile_username_format_check",
      sql`${table.username} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const group = pgTable(
  "group",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    readableId: text("readable_id").notNull(),
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
    uniqueIndex("group_readable_id_unique").on(sql`lower(${table.readableId})`),
    check(
      "group_readable_id_format_check",
      sql`${table.readableId} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
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
    readableId: text("readable_id").notNull(),
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
      "resource_readable_id_format_check",
      sql`${table.readableId} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check(
      "resource_moderation_metadata_check",
      sql`(${table.isAdminHidden} = false AND ${table.moderationReason} IS NULL AND ${table.moderatedAt} IS NULL AND ${table.moderatedByUserId} IS NULL) OR (${table.isAdminHidden} = true AND ${table.moderationReason} IS NOT NULL AND ${table.moderatedAt} IS NOT NULL)`,
    ),
    uniqueIndex("resource_user_readable_id_kind_unique").on(
      table.ownerUserId,
      table.kind,
      sql`lower(${table.readableId})`,
    ),
    uniqueIndex("resource_group_readable_id_kind_unique").on(
      table.ownerGroupId,
      table.kind,
      sql`lower(${table.readableId})`,
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
    campaignId: uuid("campaign_id").references(() => campaign.resourceId, {
      onDelete: "cascade",
    }),
    campaignAudience: campaignAudience("campaign_audience"),
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
      sql`num_nonnulls(${table.userId}, ${table.groupId}, ${table.campaignId}) = 1`,
    ),
    check(
      "resource_grant_campaign_audience_check",
      sql`(${table.campaignId} IS NULL AND ${table.campaignAudience} IS NULL) OR (${table.campaignId} IS NOT NULL AND ${table.campaignAudience} IS NOT NULL)`,
    ),
    uniqueIndex("resource_grant_user_unique")
      .on(table.resourceId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex("resource_grant_group_unique")
      .on(table.resourceId, table.groupId)
      .where(sql`${table.groupId} IS NOT NULL`),
    uniqueIndex("resource_grant_campaign_unique")
      .on(table.resourceId, table.campaignId)
      .where(sql`${table.campaignId} IS NOT NULL`),
    index("resource_grant_resource_id_idx").on(table.resourceId),
    index("resource_grant_user_id_idx").on(table.userId),
    index("resource_grant_group_id_idx").on(table.groupId),
    index("resource_grant_campaign_id_idx").on(table.campaignId),
  ],
);

export const system = pgTable("system", {
  resourceId: uuid("resource_id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
});

export const campaign = pgTable("campaign", {
  resourceId: uuid("resource_id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.resourceId, { onDelete: "restrict" }),
});

export const campaignMembership = pgTable(
  "campaign_membership",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.resourceId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: campaignRole("role").default("player").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.campaignId, table.userId] }),
    index("campaign_membership_user_id_idx").on(table.userId),
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
    .default("general")
    .notNull(),
  hasStrictSchema: boolean("has_strict_schema").default(false).notNull(),
  // `json`, not `jsonb`: jsonb reorders object keys, and field order matters
  // for generated sheets.
  schema: json("schema")
    .$type<ContentTypeSchema>()
    .default(sql`'{}'::json`)
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
    // Initial state of the Content page's Edit and Autosave switches.
    defaultEditMode: boolean("default_edit_mode").default(false).notNull(),
    defaultAutosave: boolean("default_autosave").default(false).notNull(),
    // How fields look when they can't be edited; `display` in the markup
    // overrides it.
    defaultDisplay: sheetDisplay("default_display").default("text").notNull(),
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
export type Campaign = typeof campaign.$inferSelect;
export type NewCampaign = typeof campaign.$inferInsert;
export type ContentType = typeof contentType.$inferSelect;
export type NewContentType = typeof contentType.$inferInsert;
export type Sheet = typeof sheet.$inferSelect;
export type NewSheet = typeof sheet.$inferInsert;
export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;
