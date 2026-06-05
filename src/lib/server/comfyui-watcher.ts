import { getFileSyncService } from "./file-sync-service";

type Subscriber = (path: string) => void;

export function subscribe(fn: Subscriber): () => void {
  const wrappedFn = (event: { type: string; path: string }) => {
    fn(event.path);
  };

  // Get service lazily and subscribe
  let unsub: (() => void) | null = null;
  getFileSyncService().then((service) => {
    if (service) {
      unsub = service.subscribe(wrappedFn);
    }
  });

  return () => {
    unsub?.();
  };
}
