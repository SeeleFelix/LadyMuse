import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(datetime('now'))`;

// Art Knowledge Base
export const artCategories = sqliteTable("art_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  description: text("description"),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0),
});

export const artSubcategories = sqliteTable("art_subcategories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => artCategories.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
});

export const artTechniques = sqliteTable("art_techniques", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subcategoryId: integer("subcategory_id")
    .notNull()
    .references(() => artSubcategories.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  description: text("description"),
  promptKeywords: text("prompt_keywords").notNull(),
  nlDescription: text("nl_description"),
  weightHint: real("weight_hint").default(1.0),
  negativeKeywords: text("negative_keywords"),
  exampleImage: text("example_image"),
  tags: text("tags"),
  moodTags: text("mood_tags"),
  difficulty: text("difficulty").default("beginner"),
  sortOrder: integer("sort_order").default(0),
});

// Style Library
export const styleFamilies = sqliteTable("style_families", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  description: text("description"),
  coverImage: text("cover_image"),
  sortOrder: integer("sort_order").default(0),
});

export const styles = sqliteTable("styles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id")
    .notNull()
    .references(() => styleFamilies.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  description: text("description"),
  positiveTemplate: text("positive_template").notNull(),
  nlTemplate: text("nl_template"),
  negativePrompt: text("negative_prompt"),
  qualityTags: text("quality_tags"),
  recommendedParams: text("recommended_params"),
  exampleImages: text("example_images"),
  tags: text("tags"),
  sortOrder: integer("sort_order").default(0),
});

export const styleTechniqueRecs = sqliteTable("style_technique_recs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  styleId: integer("style_id")
    .notNull()
    .references(() => styles.id),
  techniqueId: integer("technique_id")
    .notNull()
    .references(() => artTechniques.id),
  relevance: real("relevance").default(1.0),
});

// Prompts
export const promptTemplates = sqliteTable("prompt_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags"),
  isBuiltin: integer("is_builtin", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),
});

export const prompts = sqliteTable("prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title"),
  positivePrompt: text("positive_prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  styleId: integer("style_id").references(() => styles.id),
  workflowJson: text("workflow_json"),
  notes: text("notes"),
  rating: integer("rating"),
  tags: text("tags"),
  source: text("source").default("manual"),
  sampler: text("sampler"),
  scheduler: text("scheduler"),
  steps: integer("steps"),
  cfgScale: real("cfg_scale"),
  width: integer("width"),
  height: integer("height"),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),
});

export const promptVersions = sqliteTable("prompt_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptId: integer("prompt_id")
    .notNull()
    .references(() => prompts.id),
  version: integer("version").notNull(),
  positive: text("positive").notNull(),
  negative: text("negative"),
  diffSummary: text("diff_summary"),
  createdAt: text("created_at").default(now),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const promptTags = sqliteTable("prompt_tags", {
  promptId: integer("prompt_id")
    .notNull()
    .references(() => prompts.id),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id),
});

// Generations
export const generations = sqliteTable("generations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptId: integer("prompt_id").references(() => prompts.id),
  comfyuiJobId: text("comfyui_job_id"),
  imagePath: text("image_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  parametersJson: text("parameters_json"),
  width: integer("width"),
  height: integer("height"),
  seed: integer("seed"),
  sampler: text("sampler"),
  steps: integer("steps"),
  cfgScale: real("cfg_scale"),
  modelName: text("model_name"),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").default(now),
});

export const generationRatings = sqliteTable("generation_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generationId: integer("generation_id")
    .notNull()
    .references(() => generations.id),
  rating: integer("rating").notNull(),
  isFavorite: integer("is_favorite", { mode: "boolean" }).default(false),
  notes: text("notes"),
  effectiveKeywords: text("effective_keywords"),
  createdAt: text("created_at").default(now),
});

export const keywordStats = sqliteTable("keyword_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyword: text("keyword").notNull().unique(),
  usageCount: integer("usage_count").default(0),
  avgRating: real("avg_rating").default(0),
  lastUsedAt: text("last_used_at"),
  bestRating: integer("best_rating").default(0),
});

// User Config
export const userConfig = sqliteTable("user_config", {
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").default(now),
});

// Cached Models
export const cachedModels = sqliteTable("cached_models", {
  id: text("id").notNull().unique(),
  provider: text("provider").default("openrouter"),
  name: text("name"),
  description: text("description"),
  contextLength: integer("context_length"),
  pricing: text("pricing"),
  civitaiId: integer("civitai_id"),
  type: text("type"),
  baseModel: text("base_model"),
  tags: text("tags"),
  downloadCount: integer("download_count"),
  updatedAt: text("updated_at").default(now),
});

// Sessions
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").default("新对话"),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),
});

export const sessionMessages = sqliteTable("session_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  toolDetail: text("tool_detail"),
  usageJson: text("usage_json"),
  createdAt: text("created_at").default(now),
});

// Inspiration
export const inspirationSeeds = sqliteTable("inspiration_seeds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  content: text("content").notNull(),
  moodTags: text("mood_tags"),
  difficulty: text("difficulty").default("any"),
  isUsed: integer("is_used", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(now),
});

// Sync State
export const syncState = sqliteTable("sync_state", {
  key: text("key").notNull().unique(),
  lastCursor: text("last_cursor"),
  syncedCount: integer("synced_count").default(0),
  updatedAt: text("updated_at").default(now),
});

// Image Management (Lightroom-style)
export const stacks = sqliteTable("stacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  coverImagePath: text("cover_image_path"),
  collapsed: integer("collapsed", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(now),
});

export const imageAttributes = sqliteTable("image_attributes", {
  relativePath: text("relative_path").primaryKey(),
  rating: integer("rating").default(0),
  colorLabel: text("color_label"),
  flag: text("flag"),
  notes: text("notes"),
  stackId: integer("stack_id").references(() => stacks.id),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),

  // Extracted index fields (from ComfyUI workflow)
  extractedModels: text("extracted_models"),
  extractedLoras: text("extracted_loras"),
  extractedSamplers: text("extracted_samplers"),
  extractedSchedulers: text("extracted_schedulers"),
  positivePrompt: text("positive_prompt"),
  negativePrompt: text("negative_prompt"),
  steps: integer("steps").default(0),
  cfgScale: real("cfg_scale").default(0),
  seed: text("seed"),

  // Image physical properties
  width: integer("width"),
  height: integer("height"),
  aspectRatio: text("aspect_ratio"),
  fileSize: integer("file_size"),
  fileFormat: text("file_format"),
  colorSpace: text("color_space"),
  hasAlpha: integer("has_alpha", { mode: "boolean" }).default(false),

  // File tracking (for sync engine)
  fileModifiedAt: text("file_modified_at"),
  isMissing: integer("is_missing", { mode: "boolean" }).default(false),
});

// Recycle Bin — snapshots of soft-deleted image_attributes rows
export const trashedImages = sqliteTable("trashed_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  originalRelativePath: text("original_relative_path").notNull(),
  trashPath: text("trash_path").notNull(),
  rating: integer("rating").default(0),
  flag: text("flag"),
  colorLabel: text("color_label"),
  metadataJson: text("metadata_json"),
  width: integer("width"),
  height: integer("height"),
  fileFormat: text("file_format"),
  aspectRatio: text("aspect_ratio"),
  deletedAt: text("deleted_at").notNull().default(now),
});

export const imageTags = sqliteTable("image_tags", {
  relativePath: text("relative_path").notNull(),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id),
});

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  coverImagePath: text("cover_image_path"),
  isSmart: integer("is_smart", { mode: "boolean" }).default(false),
  smartCriteria: text("smart_criteria"),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),
});

export const collectionImages = sqliteTable("collection_images", {
  collectionId: integer("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
  relativePath: text("relative_path").notNull(),
  sortOrder: integer("sort_order").default(0),
  addedAt: text("added_at").default(now),
});

// Danbooru Cache
export const danbooruTagGroups = sqliteTable("danbooru_tag_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topic: text("topic").notNull(),
  section: text("section").notNull(),
  tagName: text("tag_name").notNull(),
  postCount: integer("post_count"),
  description: text("description"),
  syncedAt: text("synced_at").notNull(),
});

export const danbooruSyncLog = sqliteTable("danbooru_sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topic: text("topic").notNull(),
  syncedAt: text("synced_at").notNull(),
  tagCount: integer("tag_count").notNull(),
  descriptionsFetched: integer("descriptions_fetched").notNull(),
  descriptionsPending: integer("descriptions_pending").notNull(),
});

// Danbooru Tag Knowledge Base
export const danbooruTags = sqliteTable("danbooru_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  postCount: integer("post_count").default(0),
  body: text("body"),
  otherNames: text("other_names"),
  embedding: text("embedding"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const danbooruTagAliases = sqliteTable("danbooru_tag_aliases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  antecedentName: text("antecedent_name").notNull(),
  consequentName: text("consequent_name").notNull(),
  status: text("status").default("active"),
});

export const danbooruTagImplications = sqliteTable(
  "danbooru_tag_implications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    antecedentName: text("antecedent_name").notNull(),
    consequentName: text("consequent_name").notNull(),
    status: text("status").default("active"),
  },
);

// Usage Tracking
export const usageLogs = sqliteTable("usage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => sessions.id),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheHitTokens: integer("cache_hit_tokens").default(0),
  cost: real("cost").notNull().default(0),
  currency: text("currency").notNull().default("CNY"),
  durationMs: integer("duration_ms"),
  metadata: text("metadata"),
  createdAt: text("created_at").default(now),
});

// 知识库 — 概念
export const artConcepts = sqliteTable("art_concepts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  visualDescription: text("visual_description"),
  tags: text("tags"),
  tagUsage: text("tag_usage"),
  naturalLanguage: text("natural_language"),
  nlUsage: text("nl_usage"),
  relatedConcepts: text("related_concepts"),
  source: text("source").notNull().default("manual"),
  sourceId: text("source_id"),
  qualityVerified: integer("quality_verified").default(0),
  embedding: text("embedding"),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),
});

// 知识库 — 模式
export const artPatterns = sqliteTable("art_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  intent: text("intent"),
  structureOrder: text("structure_order"),
  compositionRules: text("composition_rules"),
  conflicts: text("conflicts"),
  involvesDimensions: text("involves_dimensions"),
  involvesConcepts: text("involves_concepts"),
  embedding: text("embedding"),
  qualityVerified: integer("quality_verified").default(0),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),
});

// 知识库 — 参考
export const artReferences = sqliteTable("art_references", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  intent: text("intent"),
  positivePrompt: text("positive_prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  paramsJson: text("params_json"),
  appliedConcepts: text("applied_concepts"),
  appliedPattern: text("applied_pattern"),
  deviations: text("deviations"),
  takeaway: text("takeaway"),
  verified: integer("verified").default(0),
  source: text("source").default("manual"),
  embedding: text("embedding"),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),
});
