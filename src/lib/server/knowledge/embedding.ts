import { getConfig } from "../config";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/embeddings";

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = await getConfig("openrouter_api_key");
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  return json.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = await getConfig("openrouter_api_key");
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  // Batch up to 20 per request
  const batchSize = 20;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!res.ok) {
      throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    for (const item of json.data) {
      results[item.index + i] = item.embedding;
    }
  }

  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
