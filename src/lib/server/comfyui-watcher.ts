import { getFileSyncService, type FileEvent } from "./file-sync-service";

type Subscriber = (path: string) => void;

export function subscribe(fn: Subscriber): () => void {
  const wrappedFn = (event: FileEvent) => {
    if ("path" in event) fn(event.path);
  };

  let cancelled = false;
  let unsub: (() => void) | null = null;

  getFileSyncService().then((service) => {
    if (!cancelled && service) {
      unsub = service.subscribe(wrappedFn);
    }
  });

  return () => {
    cancelled = true;
    unsub?.();
  };
}
