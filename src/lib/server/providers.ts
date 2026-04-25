export interface ProviderDef {
  id: string;
  name: string;
  baseURL: string;
  apiKeyConfigKey: string;
  modelsEndpoint: string;
}

export const providers: ProviderDef[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyConfigKey: "openrouter_api_key",
    modelsEndpoint: "https://openrouter.ai/api/v1/models",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    apiKeyConfigKey: "deepseek_api_key",
    modelsEndpoint: "https://api.deepseek.com/models",
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return providers.find((p) => p.id === id);
}
