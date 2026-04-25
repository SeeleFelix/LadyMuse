import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { chatStream, DEFAULT_MODEL } from "$lib/server/agent/index";

export const POST: RequestHandler = async ({ request }) => {
  const { messages, model, provider } = await request.json();

  if (!messages || !Array.isArray(messages)) {
    return json({ error: "messages required" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of chatStream(
          messages,
          model,
          provider,
          request.signal,
        )) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error("[chat] stream error:", e);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "error", content: e.message }) + "\n",
            ),
          );
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
};
