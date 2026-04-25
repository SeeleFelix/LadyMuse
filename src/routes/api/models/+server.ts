import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getConfig } from "$lib/server/config";
import { db } from "$lib/server/db";
import { cachedModels } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { providers } from "$lib/server/providers";
import { refreshModels } from "$lib/server/models";

export const GET: RequestHandler = async ({ url }) => {
  const refresh = url.searchParams.get("refresh") === "1";
  const targetProvider = url.searchParams.get("provider");

  // Manual refresh
  if (refresh && targetProvider) {
    try {
      await refreshModels(targetProvider);
    } catch (e: any) {
      return json({ error: e.message }, { status: 500 });
    }
  }

  // Auto-fetch: if a provider has an API key but no cached models, refresh it
  if (!refresh) {
    for (const provider of providers) {
      const apiKey = await getConfig(provider.apiKeyConfigKey);
      if (!apiKey) continue;
      const existing = await db
        .select({ id: cachedModels.id })
        .from(cachedModels)
        .where(eq(cachedModels.provider, provider.id))
        .limit(1);
      if (existing.length === 0) {
        try {
          await refreshModels(provider.id);
        } catch {
          // silent fail — don't block the response
        }
      }
    }
  }

  if (targetProvider) {
    const models = await db
      .select()
      .from(cachedModels)
      .where(eq(cachedModels.provider, targetProvider));
    return json(models);
  }

  const models = await db.select().from(cachedModels);
  return json(models);
};
