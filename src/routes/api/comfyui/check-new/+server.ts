import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkForNewImages } from "$lib/server/comfyui-browser";

export const GET: RequestHandler = async () => {
  const result = await checkForNewImages();
  return json(result);
};
