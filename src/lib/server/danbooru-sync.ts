import { db } from "./db";
import { danbooruTagGroups, danbooruSyncLog } from "./db/schema";
import { eq, and, isNull, sql, count } from "drizzle-orm";
import {
  fetchTagGroup,
  fetchTagCounts,
  fetchTagWiki,
  TAG_GROUP_TOPICS,
} from "./danbooru";

export type DanbooruTopic = keyof typeof TAG_GROUP_TOPICS;

// --- Types ---

export interface SyncResult {
  topics: {
    topic: string;
    tagsFound: number;
    tagsAdded: number;
    tagsRemoved: number;
  }[];
  totalTags: number;
}

export interface DescSyncResult {
  fetched: number;
  failed: number;
  remaining: number;
}

export interface TopicStatus {
  topic: string;
  tagCount: number;
  descriptionsFetched: number;
  descriptionsPending: number;
  lastSyncedAt: string | null;
}

// --- Sync Functions ---

/**
 * Full sync of tag group structure (8 topics, ~8 API calls).
 * Compares with existing data: adds new tags, removes deleted ones.
 */
export async function syncTagGroups(): Promise<SyncResult> {
  const result: SyncResult["topics"] = [];
  const now = new Date().toISOString();

  for (const [topic, wikiPage] of Object.entries(TAG_GROUP_TOPICS)) {
    const groups = await fetchTagGroup(wikiPage);
    const allTags: string[] = [];
    const tagSections = new Map<string, string>(); // tag → section

    for (const group of groups) {
      for (const tag of group.tags) {
        allTags.push(tag);
        tagSections.set(tag, group.section);
      }
    }

    // Remove duplicates
    const uniqueTags = [...new Set(allTags)];

    // Get existing tags for this topic
    const existing = await db
      .select({ tagName: danbooruTagGroups.tagName })
      .from(danbooruTagGroups)
      .where(eq(danbooruTagGroups.topic, topic));
    const existingSet = new Set(existing.map((r) => r.tagName));

    const newTags = uniqueTags.filter((t) => !existingSet.has(t));
    const removedTags = [...existingSet].filter((t) => !uniqueTags.includes(t));

    // Delete removed tags
    if (removedTags.length > 0) {
      for (const tag of removedTags) {
        await db
          .delete(danbooruTagGroups)
          .where(
            and(
              eq(danbooruTagGroups.topic, topic),
              eq(danbooruTagGroups.tagName, tag),
            ),
          );
      }
    }

    // Insert new tags
    if (newTags.length > 0) {
      // Fetch post counts in background (best effort)
      let postCounts = new Map<string, number>();
      try {
        postCounts = await fetchTagCounts(newTags);
      } catch {
        // Continue without post counts
      }

      await db.insert(danbooruTagGroups).values(
        newTags.map((tag) => ({
          topic,
          section: tagSections.get(tag) || "",
          tagName: tag,
          postCount: postCounts.get(tag) ?? null,
          syncedAt: now,
        })),
      );
    }

    // Update sync timestamp for existing tags
    if (existingSet.size > 0) {
      await db
        .update(danbooruTagGroups)
        .set({ syncedAt: now })
        .where(eq(danbooruTagGroups.topic, topic));
    }

    // Count current state
    const totalForTopic = await db
      .select({ count: count() })
      .from(danbooruTagGroups)
      .where(eq(danbooruTagGroups.topic, topic));

    const fetchedForTopic = await db
      .select({ count: count() })
      .from(danbooruTagGroups)
      .where(
        and(
          eq(danbooruTagGroups.topic, topic),
          sql`${danbooruTagGroups.description} IS NOT NULL`,
        ),
      );

    const total = totalForTopic[0]?.count ?? 0;
    const fetched = fetchedForTopic[0]?.count ?? 0;

    // Log sync
    await db.insert(danbooruSyncLog).values({
      topic,
      syncedAt: now,
      tagCount: total,
      descriptionsFetched: fetched,
      descriptionsPending: total - fetched,
    });

    result.push({
      topic,
      tagsFound: uniqueTags.length,
      tagsAdded: newTags.length,
      tagsRemoved: removedTags.length,
    });
  }

  const totalTags = await db.select({ count: count() }).from(danbooruTagGroups);

  return { topics: result, totalTags: totalTags[0]?.count ?? 0 };
}

/**
 * Incremental sync of tag wiki descriptions.
 * Fetches up to `limit` descriptions for tags that don't have one yet.
 * Rate limited to 1 req/s.
 */
export async function syncDescriptions(limit = 50): Promise<DescSyncResult> {
  // Find tags without descriptions
  const pending = await db
    .select({
      id: danbooruTagGroups.id,
      tagName: danbooruTagGroups.tagName,
      topic: danbooruTagGroups.topic,
    })
    .from(danbooruTagGroups)
    .where(isNull(danbooruTagGroups.description))
    .limit(limit);

  let fetched = 0;
  let failed = 0;

  for (const row of pending) {
    const desc = await fetchTagWiki(row.tagName);
    if (desc) {
      await db
        .update(danbooruTagGroups)
        .set({ description: desc })
        .where(eq(danbooruTagGroups.id, row.id));
      fetched++;
    } else {
      // Mark as having empty description so we don't retry forever
      await db
        .update(danbooruTagGroups)
        .set({ description: "" })
        .where(eq(danbooruTagGroups.id, row.id));
      failed++;
    }
  }

  // Count remaining
  const remaining = await db
    .select({ count: count() })
    .from(danbooruTagGroups)
    .where(isNull(danbooruTagGroups.description));

  return {
    fetched,
    failed,
    remaining: remaining[0]?.count ?? 0,
  };
}

/**
 * Get sync status for all topics (for admin page display).
 */
export async function getSyncStatus(): Promise<TopicStatus[]> {
  const statuses: TopicStatus[] = [];

  for (const topic of Object.keys(TAG_GROUP_TOPICS)) {
    const total = await db
      .select({ count: count() })
      .from(danbooruTagGroups)
      .where(eq(danbooruTagGroups.topic, topic));

    const fetched = await db
      .select({ count: count() })
      .from(danbooruTagGroups)
      .where(
        and(
          eq(danbooruTagGroups.topic, topic),
          sql`${danbooruTagGroups.description} IS NOT NULL AND ${danbooruTagGroups.description} != ''`,
        ),
      );

    const lastLog = await db
      .select()
      .from(danbooruSyncLog)
      .where(eq(danbooruSyncLog.topic, topic))
      .orderBy(sql`${danbooruSyncLog.syncedAt} DESC`)
      .limit(1);

    const tagCount = total[0]?.count ?? 0;
    const descCount = fetched[0]?.count ?? 0;

    statuses.push({
      topic,
      tagCount,
      descriptionsFetched: descCount,
      descriptionsPending: tagCount - descCount,
      lastSyncedAt: lastLog[0]?.syncedAt ?? null,
    });
  }

  return statuses;
}

/**
 * Get tags for a topic, grouped by section, sorted by postCount.
 * Used by the agent tool at runtime.
 */
export async function getTagsByTopic(
  topic: DanbooruTopic,
): Promise<
  {
    section: string;
    tagName: string;
    postCount: number | null;
    description: string | null;
  }[]
> {
  return db
    .select({
      section: danbooruTagGroups.section,
      tagName: danbooruTagGroups.tagName,
      postCount: danbooruTagGroups.postCount,
      description: danbooruTagGroups.description,
    })
    .from(danbooruTagGroups)
    .where(eq(danbooruTagGroups.topic, topic))
    .orderBy(sql`${danbooruTagGroups.postCount} DESC NULLS LAST`);
}
