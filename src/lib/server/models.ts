import { getConfig } from "./config";
import { db } from "./db";
import { cachedModels } from "./db/schema";
import { eq } from "drizzle-orm";
import { providers } from "./providers";

export async function refreshModels(providerId: string): Promise<number> {
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) throw new Error(`未知提供商: ${providerId}`);

  const apiKey = await getConfig(provider.apiKeyConfigKey);
  if (!apiKey) throw new Error(`请先设置 ${provider.name} API Key`);

  const res = await fetch(provider.modelsEndpoint, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`${provider.name} 返回错误: ${res.status}`);

  const body = await res.json();
  const data: any[] = body.data || [];

  await db.delete(cachedModels).where(eq(cachedModels.provider, providerId));
  const now = new Date().toISOString();
  for (const m of data) {
    await db.insert(cachedModels).values({
      id: m.id,
      provider: providerId,
      name: m.name || m.id,
      description: m.description,
      contextLength: m.context_length,
      pricing: JSON.stringify(m.pricing || {}),
      updatedAt: now,
    });
  }
  return data.length;
}
