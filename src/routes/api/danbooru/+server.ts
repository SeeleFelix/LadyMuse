import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSyncStatus, getTagsByTopic } from "$lib/server/danbooru-sync";
import { TAG_GROUP_TOPICS, type DanbooruTopic } from "$lib/server/danbooru";

export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get("action");

  if (action === "status") {
    const statuses = await getSyncStatus();
    return json(statuses);
  }

  if (action === "tags") {
    const topic = url.searchParams.get("topic") as DanbooruTopic | null;
    if (!topic || !TAG_GROUP_TOPICS[topic]) {
      return json({ error: "Invalid topic" }, { status: 400 });
    }
    const tags = await getTagsByTopic(topic);
    return json({ topic, tags });
  }

  // Default: return status overview
  const statuses = await getSyncStatus();
  return json(statuses);
};
