import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getConfig, setConfig, getAllConfig } from "$lib/server/config";
import { providers } from "$lib/server/providers";
import { refreshModels } from "$lib/server/models";

export const GET: RequestHandler = async () => {
  const config = await getAllConfig();
  return json(config);
};

export const POST: RequestHandler = async ({ request }) => {
  const { key, value } = await request.json();
  if (!key || typeof value !== "string") {
    return json({ error: "key 和 value 必填" }, { status: 400 });
  }
  await setConfig(key, value);

  // If saving an API key, auto-refresh models for that provider
  let modelsRefreshed = false;
  if (value) {
    const provider = providers.find((p) => p.apiKeyConfigKey === key);
    if (provider) {
      try {
        await refreshModels(provider.id);
        modelsRefreshed = true;
      } catch {
        // silent — key might be invalid, don't block the save
      }
    }
  }

  return json({ success: true, modelsRefreshed });
};
