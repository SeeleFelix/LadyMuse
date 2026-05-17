import type { RequestHandler } from "./$types";
import {
  addSSEClient,
  removeSSEClient,
} from "$lib/server/knowledge/sync-status";

export const GET: RequestHandler = async ({ request }) => {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(new TextEncoder().encode(data));
      };

      addSSEClient(send);

      request.signal.addEventListener("abort", () => {
        removeSSEClient(send);
        controller.close();
      });
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
