import type { RequestHandler } from "./$types";
import {
  addSSEClient,
  removeSSEClient,
} from "$lib/server/knowledge/sync-status";

export const GET: RequestHandler = async ({ request }) => {
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(data));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        removeSSEClient(send);
        try {
          controller.close();
        } catch {}
      };

      addSSEClient(send);
      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
