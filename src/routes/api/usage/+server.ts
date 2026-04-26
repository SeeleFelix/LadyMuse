import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getUsageStats, checkBudget } from "$lib/server/cost-tracker";

export const GET: RequestHandler = async () => {
  const [stats, budget] = await Promise.all([getUsageStats(), checkBudget()]);
  return json({ ...stats, budget });
};
