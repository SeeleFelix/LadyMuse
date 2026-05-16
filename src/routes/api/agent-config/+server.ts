import { readFileSync } from "fs";
import { join } from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getConfig, setConfig } from "$lib/server/config";

const DEFAULT_PATH = join(
  process.cwd(),
  "src/lib/server/agent/prompts/modules.json",
);

function readDefaults() {
  return JSON.parse(readFileSync(DEFAULT_PATH, "utf-8"));
}

export const GET: RequestHandler = async () => {
  const defaults = readDefaults();

  const modulesJson = await getConfig("agent_modules");
  const toolsJson = await getConfig("agent_tools");

  return json({
    shared_modules: modulesJson
      ? JSON.parse(modulesJson)
      : defaults.shared_modules,
    model_modules: defaults.model_modules,
    tools: toolsJson ? JSON.parse(toolsJson) : defaults.tools,
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
