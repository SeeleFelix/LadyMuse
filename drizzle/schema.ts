import {
  sqliteTable,
  AnySQLiteColumn,
  uniqueIndex,
  integer,
  text,
  foreignKey,
  real,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const artCategories = sqliteTable(
  "art_categories",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    nameZh: text("name_zh"),
    description: text(),
    icon: text(),
    sortOrder: integer("sort_order").default(0),
  },
  (table) => [uniqueIndex("art_categories_slug_unique").on(table.slug)],
);

export const artSubcategories = sqliteTable(
  "art_subcategories",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => artCategories.id),
    slug: text().notNull(),
    name: text().notNull(),
    nameZh: text("name_zh"),
    description: text(),
    sortOrder: integer("sort_order").default(0),
  },
  (table) => [uniqueIndex("art_subcategories_slug_unique").on(table.slug)],
);

export const artTechniques = sqliteTable(
  "art_techniques",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    subcategoryId: integer("subcategory_id")
      .notNull()
      .references(() => artSubcategories.id),
    slug: text().notNull(),
    name: text().notNull(),
    nameZh: text("name_zh"),
    description: text(),
    promptKeywords: text("prompt_keywords").notNull(),
    weightHint: real("weight_hint").default(1),
    negativeKeywords: text("negative_keywords"),
    exampleImage: text("example_image"),
    tags: text(),
    moodTags: text("mood_tags"),
    difficulty: text().default("beginner"),
    sortOrder: integer("sort_order").default(0),
    nlDescription: text("nl_description"),
  },
  (table) => [uniqueIndex("art_techniques_slug_unique").on(table.slug)],
);

export const keywordStats = sqliteTable(
  "keyword_stats",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    keyword: text().notNull(),
    usageCount: integer("usage_count").default(0),
    avgRating: real("avg_rating"),
    lastUsedAt: text("last_used_at"),
    bestRating: integer("best_rating").default(0),
  },
  (table) => [uniqueIndex("keyword_stats_keyword_unique").on(table.keyword)],
);

export const promptTags = sqliteTable("prompt_tags", {
  promptId: integer("prompt_id")
    .notNull()
    .references(() => prompts.id),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id),
});

export const styleFamilies = sqliteTable(
  "style_families",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    nameZh: text("name_zh"),
    description: text(),
    coverImage: text("cover_image"),
    sortOrder: integer("sort_order").default(0),
  },
  (table) => [uniqueIndex("style_families_slug_unique").on(table.slug)],
);

export const styleTechniqueRecs = sqliteTable("style_technique_recs", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  styleId: integer("style_id")
    .notNull()
    .references(() => styles.id),
  techniqueId: integer("technique_id")
    .notNull()
    .references(() => artTechniques.id),
  relevance: real().default(1),
});

export const styles = sqliteTable(
  "styles",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    familyId: integer("family_id")
      .notNull()
      .references(() => styleFamilies.id),
    slug: text().notNull(),
    name: text().notNull(),
    nameZh: text("name_zh"),
    description: text(),
    positiveTemplate: text("positive_template").notNull(),
    negativePrompt: text("negative_prompt"),
    qualityTags: text("quality_tags"),
    recommendedParams: text("recommended_params"),
    exampleImages: text("example_images"),
    tags: text(),
    sortOrder: integer("sort_order").default(0),
    nlTemplate: text("nl_template"),
  },
  (table) => [uniqueIndex("styles_slug_unique").on(table.slug)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    name: text().notNull(),
    slug: text().notNull(),
  },
  (table) => [
    uniqueIndex("tags_slug_unique").on(table.slug),
    uniqueIndex("tags_name_unique").on(table.name),
  ],
);

export const cachedModels = sqliteTable(
  "cached_models",
  {
    id: text().notNull(),
    provider: text().default("openrouter"),
    name: text(),
    description: text(),
    contextLength: integer("context_length"),
    pricing: text(),
    updatedAt: text("updated_at").default("(datetime('now'))"),
    civitaiId: integer("civitai_id"),
    type: text(),
    baseModel: text("base_model"),
    tags: text(),
    downloadCount: integer("download_count"),
  },
  (table) => [uniqueIndex("cached_models_id_unique").on(table.id)],
);

export const generationRatings = sqliteTable("generation_ratings", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  generationId: integer("generation_id")
    .notNull()
    .references(() => generations.id),
  rating: integer().notNull(),
  isFavorite: integer("is_favorite").default(false),
  notes: text(),
  effectiveKeywords: text("effective_keywords"),
  createdAt: text("created_at").default("(datetime('now'))"),
});

export const generations = sqliteTable("generations", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  promptId: integer("prompt_id")
    .notNull()
    .references(() => prompts.id),
  comfyuiJobId: text("comfyui_job_id"),
  imagePath: text("image_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  parametersJson: text("parameters_json"),
  width: integer(),
  height: integer(),
  seed: integer(),
  sampler: text(),
  steps: integer(),
  cfgScale: real("cfg_scale"),
  modelName: text("model_name"),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").default("(datetime('now'))"),
});

export const inspirationSeeds = sqliteTable("inspiration_seeds", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  type: text().notNull(),
  content: text().notNull(),
  moodTags: text("mood_tags"),
  difficulty: text().default("any"),
  isUsed: integer("is_used").default(false),
  createdAt: text("created_at").default("(datetime('now'))"),
});

export const promptTemplates = sqliteTable("prompt_templates", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  name: text().notNull(),
  content: text().notNull(),
  category: text(),
  tags: text(),
  isBuiltin: integer("is_builtin").default(false),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});

export const promptVersions = sqliteTable("prompt_versions", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  promptId: integer("prompt_id")
    .notNull()
    .references(() => prompts.id),
  version: integer().notNull(),
  positive: text().notNull(),
  negative: text(),
  diffSummary: text("diff_summary"),
  createdAt: text("created_at").default("(datetime('now'))"),
});

export const prompts = sqliteTable("prompts", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  title: text(),
  positivePrompt: text("positive_prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  styleId: integer("style_id").references(() => styles.id),
  workflowJson: text("workflow_json"),
  notes: text(),
  rating: integer(),
  tags: text(),
  source: text().default("manual"),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
  sampler: text(),
  scheduler: text(),
  steps: integer(),
  cfgScale: real("cfg_scale"),
  width: integer(),
  height: integer(),
});

export const sessionMessages = sqliteTable("session_messages", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id),
  role: text().notNull(),
  content: text().notNull(),
  toolDetail: text("tool_detail"),
  createdAt: text("created_at").default("(datetime('now'))"),
});

export const sessions = sqliteTable("sessions", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  title: text().default("新对话"),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});

export const userConfig = sqliteTable(
  "user_config",
  {
    key: text().notNull(),
    value: text().notNull(),
    updatedAt: text("updated_at").default("(datetime('now'))"),
  },
  (table) => [uniqueIndex("user_config_key_unique").on(table.key)],
);

export const syncState = sqliteTable(
  "sync_state",
  {
    key: text().notNull(),
    lastCursor: text("last_cursor"),
    syncedCount: integer("synced_count").default(0),
    updatedAt: text("updated_at").default("(datetime('now'))"),
  },
  (table) => [uniqueIndex("sync_state_key_unique").on(table.key)],
);
