import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const CONFIG_PATH = join(
  process.cwd(),
  "src/lib/server/agent/prompts/modules.json",
);

interface ModuleConfig {
  file: string;
  enabled: boolean;
}

interface ToolConfig {
  name: string;
  enabled: boolean;
}

interface AgentConfig {
  modules: ModuleConfig[];
  tools: ToolConfig[];
}

export const GET: RequestHandler = async () => {
  const config: AgentConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  return json(config);
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const config: AgentConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

  if (body.modules) {
    config.modules = body.modules;
  }
  if (body.tools) {
    config.tools = body.tools;
  }

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
  return json({ ok: true });
};
