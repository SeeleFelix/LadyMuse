import { db } from "$lib/server/db";
import { imageAttributes, imageTags, tags } from "$lib/server/db/schema";
import {
  eq,
  gte,
  lte,
  inArray,
  like,
  and,
  or,
  isNull,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";

export interface SmartRule {
  field: string;
  op: string;
  value: any;
}

export interface SmartCriteria {
  operator: "AND" | "OR";
  rules: SmartRule[];
}

export async function evaluateSmartCollection(
  criteria: SmartCriteria,
): Promise<string[]> {
  if (!criteria.rules || criteria.rules.length === 0) return [];

  const conditions = [];

  for (const rule of criteria.rules) {
    const cond = buildCondition(rule);
    if (cond) conditions.push(cond);
  }

  if (conditions.length === 0) return [];

  const combineFn = criteria.operator === "OR" ? or : and;
  const where = combineFn(...conditions);

  const result = await db
    .select({ relativePath: imageAttributes.relativePath })
    .from(imageAttributes)
    .where(where);

  // Post-filter for tag-based rules that need joins
  let paths = result.map((r) => r.relativePath);

  for (const rule of criteria.rules) {
    if (rule.field === "tag") {
      paths = await filterByTag(paths, rule);
    } else if (rule.field === "has_tags") {
      paths = await filterByHasTags(paths, rule);
    }
  }

  return paths;
}

/**
 * Build a SQL condition for a single rule
 * Supports standard fields and JSON array fields
 */
function buildCondition(rule: SmartRule): SQL | null {
  // Handle JSON array fields (model, loras, sampler, scheduler)
  if (isJsonArrayField(rule.field)) {
    return buildJsonArrayCondition(rule);
  }

  // Handle standard fields
  const col = getColumn(rule.field);
  if (!col) return null;

  switch (rule.op) {
    case "=":
      return eq(col, rule.value);
    case "!=":
      return sql`${col} != ${rule.value}`;
    case ">":
      return sql`${col} > ${rule.value}`;
    case ">=":
      return gte(col, rule.value);
    case "<":
      return sql`${col} < ${rule.value}`;
    case "<=":
      return lte(col, rule.value);
    case "in":
      return inArray(col, rule.value);
    case "not_in":
      return sql`${col} NOT IN ${rule.value}`;
    case "contains":
      return like(col, `%${rule.value}%`);
    case "not_contains":
      return sql`${col} NOT LIKE ${`%${rule.value}%`}`;
    case "is_empty":
      return sql`(${col} IS NULL OR ${col} = '')`;
    case "is_not_empty":
      return sql`(${col} IS NOT NULL AND ${col} != '')`;
    case "is_null":
      return isNull(col);
    case "is_not_null":
      return isNotNull(col);
    default:
      return null;
  }
}

/**
 * Build a SQL condition for JSON array fields
 * Uses json_each() to check if a value exists in the JSON array
 */
function buildJsonArrayCondition(rule: SmartRule): SQL | null {
  const col = getJsonArrayColumn(rule.field);
  if (!col) return null;

  switch (rule.op) {
    case "in":
      // Check if any value in the array matches any in the provided list
      if (!Array.isArray(rule.value) || rule.value.length === 0) {
        return null;
      }
      // Build condition: json_extract(column, '$') LIKE '%"value1"%' OR ...
      const conditions = rule.value.map(
        (v: string) => sql`${col} LIKE ${`%"${v}"%`}`,
      );
      return conditions.length === 1
        ? conditions[0]
        : (or(...conditions) ?? sql`1=0`);
    case "not_in":
      // Check if none of the values in the list are in the array
      if (!Array.isArray(rule.value) || rule.value.length === 0) {
        return null;
      }
      const notConditions = rule.value.map(
        (v: string) => sql`${col} NOT LIKE ${`%"${v}"%`}`,
      );
      return and(...notConditions) ?? sql`1=1`;
    case "is_empty":
      return sql`(${col} IS NULL OR ${col} = '[]' OR ${col} = '')`;
    case "is_not_empty":
      return sql`(${col} IS NOT NULL AND ${col} != '[]' AND ${col} != '')`;
    case "is_null":
      return isNull(col);
    case "is_not_null":
      return isNotNull(col);
    default:
      return null;
  }
}

/**
 * Check if a field is a JSON array field (requires special handling)
 */
function isJsonArrayField(field: string): boolean {
  return ["model", "loras", "sampler", "scheduler"].includes(field);
}

/**
 * Get the JSON array column for a field
 */
function getJsonArrayColumn(field: string) {
  switch (field) {
    case "model":
      return imageAttributes.extractedModels;
    case "loras":
      return imageAttributes.extractedLoras;
    case "sampler":
      return imageAttributes.extractedSamplers;
    case "scheduler":
      return imageAttributes.extractedSchedulers;
    default:
      return null;
  }
}

/**
 * Get the column for a standard field
 */
function getColumn(field: string) {
  switch (field) {
    // User marks
    case "rating":
      return imageAttributes.rating;
    case "color_label":
      return imageAttributes.colorLabel;
    case "flag":
      return imageAttributes.flag;
    // Generation params
    case "steps":
      return imageAttributes.steps;
    case "cfg":
      return imageAttributes.cfgScale;
    case "seed":
      return imageAttributes.seed;
    case "positive_prompt":
      return imageAttributes.positivePrompt;
    case "negative_prompt":
      return imageAttributes.negativePrompt;
    // Properties
    case "width":
      return imageAttributes.width;
    case "height":
      return imageAttributes.height;
    case "aspect_ratio":
      return imageAttributes.aspectRatio;
    case "file_format":
      return imageAttributes.fileFormat;
    case "has_alpha":
      return imageAttributes.hasAlpha;
    default:
      return null;
  }
}

async function filterByTag(
  paths: string[],
  rule: SmartRule,
): Promise<string[]> {
  if (paths.length === 0) return [];

  const tagRows = await db
    .select({ relativePath: imageTags.relativePath })
    .from(imageTags)
    .innerJoin(tags, eq(imageTags.tagId, tags.id))
    .where(
      and(
        inArray(imageTags.relativePath, paths),
        like(tags.name, `%${rule.value}%`),
      ),
    );

  const matchSet = new Set(tagRows.map((r) => r.relativePath));
  return paths.filter((p) => matchSet.has(p));
}

async function filterByHasTags(
  paths: string[],
  rule: SmartRule,
): Promise<string[]> {
  if (paths.length === 0) return [];

  const tagged = await db
    .selectDistinct({ relativePath: imageTags.relativePath })
    .from(imageTags)
    .where(inArray(imageTags.relativePath, paths));

  const taggedSet = new Set(tagged.map((r) => r.relativePath));

  if (rule.value === false) {
    return paths.filter((p) => !taggedSet.has(p));
  }
  return paths.filter((p) => taggedSet.has(p));
}

export const BUILTIN_SMART_COLLECTIONS: {
  name: string;
  criteria: SmartCriteria;
}[] = [
  {
    name: "全部 5 星",
    criteria: {
      operator: "AND",
      rules: [{ field: "rating", op: ">=", value: 5 }],
    },
  },
  {
    name: "已标记 Pick",
    criteria: {
      operator: "AND",
      rules: [{ field: "flag", op: "=", value: "pick" }],
    },
  },
  {
    name: "已标记 Reject",
    criteria: {
      operator: "AND",
      rules: [{ field: "flag", op: "=", value: "reject" }],
    },
  },
  {
    name: "未评分",
    criteria: {
      operator: "AND",
      rules: [{ field: "rating", op: "=", value: 0 }],
    },
  },
  {
    name: "未打标签",
    criteria: {
      operator: "AND",
      rules: [{ field: "has_tags", op: "=", value: false }],
    },
  },
];
