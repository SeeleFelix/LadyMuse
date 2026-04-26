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

function buildCondition(rule: SmartRule) {
  const col = getColumn(rule.field);
  if (!col) return null;

  switch (rule.op) {
    case "=":
      return eq(col, rule.value);
    case "!=":
      return sql`${col} != ${rule.value}`;
    case ">":
    case ">=":
      return gte(col, rule.value);
    case "<":
    case "<=":
      return lte(col, rule.value);
    case "in":
      return inArray(col, rule.value);
    case "contains":
      return like(col, `%${rule.value}%`);
    case "is_null":
      return isNull(col);
    case "is_not_null":
      return isNotNull(col);
    default:
      return null;
  }
}

function getColumn(field: string) {
  switch (field) {
    case "rating":
      return imageAttributes.rating;
    case "color_label":
      return imageAttributes.colorLabel;
    case "flag":
      return imageAttributes.flag;
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
