import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const SHARE_PASSWORD = "jiejiejie";
const COOKIE_NAME = "share_auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json();
  const password = body.password as string;

  if (password !== SHARE_PASSWORD) {
    return json({ error: "Incorrect password" }, { status: 401 });
  }

  cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    path: "/share",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  return json({ success: true });
};
