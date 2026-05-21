import { readFileSync } from "fs";
import { join } from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getConfig, setConfig } from "$lib/server/config";

const DEFAULT_PATH = join(
  process.cwd(),
  "src/lib/server/agent/prompts/modules.json",
);

interface ModuleConfig {
  file: string;
  enabled: boolean;
  exclusive_group?: string;
}

interface ToolConfig {
  name: string;
  enabled: boolean;
}

function readDefaults(): {
  shared_modules: ModuleConfig[];
  model_modules: Record<string, ModuleConfig>;
  tools: ToolConfig[];
} {
  return JSON.parse(readFileSync(DEFAULT_PATH, "utf-8"));
}

export const GET: RequestHandler = async () => {
  const defaults = readDefaults();

  const modulesJson = await getConfig("agent_modules");
  const toolsJson = await getConfig("agent_tools");
  const dbModules: ModuleConfig[] = modulesJson ? JSON.parse(modulesJson) : [];
  const overrideMap = new Map(dbModules.map((m) => [m.file, m]));
  const sharedModules = defaults.shared_modules.map((m) =>
    overrideMap.has(m.file)
      ? { ...m, enabled: overrideMap.get(m.file)!.enabled }
      : m,
  );

  return json({
    shared_modules: sharedModules,
    model_modules: defaults.model_modules,
    tools: toolsJson
      ? defaults.tools.map((t) => {
          const override = (JSON.parse(toolsJson!) as ToolConfig[]).find(
            (o) => o.name === t.name,
          );
          return override ? { ...t, enabled: override.enabled } : t;
        })
      : defaults.tools,
  });
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body.shared_modules) {
    await setConfig("agent_modules", JSON.stringify(body.shared_modules));
  }
  if (body.tools) {
    await setConfig("agent_tools", JSON.stringify(body.tools));
  }

  return json({ ok: true });
};
