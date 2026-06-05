import type { FileEvent } from "$lib/stores/gallery-store.svelte";

export function createSSEClient(callback: (event: FileEvent) => void) {
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    eventSource = new EventSource("/api/comfyui/watch");
    eventSource.onmessage = (e) => {
      try {
        callback(JSON.parse(e.data));
      } catch {
        // ignore parse errors
      }
    };
    eventSource.onerror = () => {
      eventSource?.close();
      reconnectTimer = setTimeout(connect, 5000);
    };
  }

  function disconnect() {
    eventSource?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  }

  connect();
  return { disconnect };
}
