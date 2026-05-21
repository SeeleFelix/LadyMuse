export interface SyncStatusData {
  running: boolean;
  source: "wikipedia" | "embedding" | null;
  stage: "downloading" | "parsing" | "importing" | "embedding" | null;
  total: number;
  done: number;
  percent: number;
  error: string | null;
  lastSync: string | null;
}

const status: SyncStatusData = {
  running: false,
  source: null,
  stage: null,
  total: 0,
  done: 0,
  percent: 0,
  error: null,
  lastSync: null,
};

const clients = new Set<(data: string) => void>();

export function getSyncStatus(): SyncStatusData {
  return { ...status };
}

export function startSync(source: "wikipedia" | "embedding"): boolean {
  if (status.running) return false;
  status.running = true;
  status.source = source;
  status.stage = "downloading";
  status.total = 0;
  status.done = 0;
  status.percent = 0;
  status.error = null;
  broadcast();
  return true;
}

export function updateProgress(update: {
  stage?: SyncStatusData["stage"];
  total?: number;
  done?: number;
}) {
  if (update.stage) status.stage = update.stage;
  if (update.total != null) status.total = update.total;
  if (update.done != null) status.done = update.done;
  if (status.total > 0) {
    status.percent = Math.min(
      100,
      Math.round((status.done / status.total) * 100),
    );
  }
  broadcast();
}

export function finishSync() {
  status.running = false;
  status.stage = null;
  status.lastSync = new Date().toISOString();
  status.source = null;
  broadcast();
}

export function failSync(error: string) {
  status.running = false;
  status.error = error;
  status.stage = null;
  status.source = null;
  broadcast();
}

export function addSSEClient(send: (data: string) => void) {
  clients.add(send);
  send(formatSSE("status", getSyncStatus()));
}

export function removeSSEClient(send: (data: string) => void) {
  clients.delete(send);
}

function broadcast() {
  const data = formatSSE("progress", getSyncStatus());
  for (const send of clients) {
    try {
      send(data);
    } catch {
      clients.delete(send);
    }
  }
}

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
