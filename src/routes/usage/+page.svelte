<script lang="ts">
  interface UsageLog {
    id: number;
    sessionId: number | null;
    provider: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cacheHitTokens: number | null;
    cost: number;
    currency: string;
    durationMs: number | null;
    metadata: string | null;
    createdAt: string;
  }

  interface StatsRow {
    currency: string;
    cost: number;
    inputTokens: number;
    outputTokens: number;
    count: number;
  }

  interface BudgetStatus {
    allowed: boolean;
    dailyCost: number;
    monthlyCost: number;
    dailyLimit: number | null;
    monthlyLimit: number | null;
  }

  let todayStats = $state<StatsRow[]>([]);
  let monthStats = $state<StatsRow[]>([]);
  let recentLogs = $state<UsageLog[]>([]);
  let budget = $state<BudgetStatus | null>(null);

  async function loadData() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        todayStats = data.today || [];
        monthStats = data.month || [];
        recentLogs = data.recentLogs || [];
        budget = data.budget || null;
      }
    } catch {}
  }

  function fmtCost(n: number, currency: string): string {
    const symbol = currency === "CNY" ? "¥" : "$";
    if (!n || !Number.isFinite(n) || n === 0) return `${symbol}0.00`;
    if (n < 0.01) return `${symbol}${n.toFixed(4)}`;
    return `${symbol}${n.toFixed(2)}`;
  }

  function fmtTokens(n: number): string {
    if (!n || !Number.isFinite(n)) return "0";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  }

  function fmtDuration(ms: number): string {
    if (!ms || !Number.isFinite(ms)) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function fmtTime(s: string): string {
    const d = new Date(s.includes(" ") ? s.replace(" ", "T") : s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function costColor(cost: number, currency: string): string {
    const threshold = currency === "CNY" ? 0.5 : 0.05;
    if (cost > threshold * 10) return "text-red-400";
    if (cost > threshold) return "text-yellow-400";
    if (cost > 0) return "text-emerald-400";
    return "text-zinc-500";
  }

  let todayTotal = $derived(todayStats.reduce((sum, s) => sum + s.cost, 0));
  let monthTotal = $derived(monthStats.reduce((sum, s) => sum + s.cost, 0));
  let todayTokens = $derived(
    todayStats.reduce((sum, s) => sum + s.inputTokens + s.outputTokens, 0),
  );
  let monthTokens = $derived(
    monthStats.reduce((sum, s) => sum + s.inputTokens + s.outputTokens, 0),
  );
  let todayCount = $derived(todayStats.reduce((sum, s) => sum + s.count, 0));
  let monthCount = $derived(monthStats.reduce((sum, s) => sum + s.count, 0));

  $effect(() => {
    loadData();
  });
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-3xl px-6 py-8 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-zinc-100">用量统计</h1>
      <button
        onclick={loadData}
        class="rounded-lg border border-zinc-700/50 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
      >
        刷新
      </button>
    </div>

    <!-- Overview Cards -->
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-lg bg-zinc-900/80 p-4">
        <div class="text-[11px] uppercase tracking-wider text-zinc-600 mb-2">
          今日
        </div>
        <div
          class="text-2xl font-semibold {costColor(
            todayTotal,
            'CNY',
          )} tabular-nums"
        >
          {fmtCost(todayTotal, "CNY")}
        </div>
        <div class="mt-2 flex items-center gap-3 text-[11px] text-zinc-600">
          <span>{todayCount} 次</span>
          <span class="text-zinc-800">·</span>
          <span>{fmtTokens(todayTokens)} tokens</span>
        </div>
        {#if budget?.dailyLimit}
          {@const pct = Math.min((todayTotal / budget.dailyLimit) * 100, 100)}
          <div class="mt-3 h-1 rounded-full bg-zinc-800">
            <div
              class="h-full rounded-full transition-all {pct >= 100
                ? 'bg-red-500'
                : pct >= 80
                  ? 'bg-yellow-500'
                  : 'bg-violet-500/70'}"
              style="width: {pct}%"
            ></div>
          </div>
          <div class="mt-1 text-[10px] text-zinc-700">
            日预算 ¥{budget.dailyLimit}
          </div>
        {/if}
      </div>

      <div class="rounded-lg bg-zinc-900/80 p-4">
        <div class="text-[11px] uppercase tracking-wider text-zinc-600 mb-2">
          本月
        </div>
        <div
          class="text-2xl font-semibold {costColor(
            monthTotal,
            'CNY',
          )} tabular-nums"
        >
          {fmtCost(monthTotal, "CNY")}
        </div>
        <div class="mt-2 flex items-center gap-3 text-[11px] text-zinc-600">
          <span>{monthCount} 次</span>
          <span class="text-zinc-800">·</span>
          <span>{fmtTokens(monthTokens)} tokens</span>
        </div>
        {#if budget?.monthlyLimit}
          {@const pct = Math.min((monthTotal / budget.monthlyLimit) * 100, 100)}
          <div class="mt-3 h-1 rounded-full bg-zinc-800">
            <div
              class="h-full rounded-full transition-all {pct >= 100
                ? 'bg-red-500'
                : pct >= 80
                  ? 'bg-yellow-500'
                  : 'bg-violet-500/70'}"
              style="width: {pct}%"
            ></div>
          </div>
          <div class="mt-1 text-[10px] text-zinc-700">
            月预算 ¥{budget.monthlyLimit}
          </div>
        {/if}
      </div>
    </div>

    <!-- Recent Logs -->
    <div>
      <div class="mb-2 text-[11px] uppercase tracking-wider text-zinc-600">
        最近调用
      </div>
      {#if recentLogs.length > 0}
        <div
          class="space-y-px rounded-lg border border-zinc-800/50 overflow-hidden"
        >
          {#each recentLogs as log}
            <div
              class="flex items-center gap-3 bg-zinc-900/50 px-4 py-2.5 text-sm hover:bg-zinc-800/40 transition-colors"
            >
              <div
                class="w-20 flex-shrink-0 text-xs text-zinc-600 tabular-nums"
              >
                {fmtTime(log.createdAt)}
              </div>

              <span
                class="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium {log.provider ===
                'deepseek'
                  ? 'bg-sky-950/60 text-sky-400'
                  : 'bg-violet-950/60 text-violet-400'}"
              >
                {log.provider === "deepseek" ? "DS" : "OR"}
              </span>

              <div class="flex-1 min-w-0">
                <div class="truncate text-xs text-zinc-400">{log.modelId}</div>
              </div>

              <div class="flex-shrink-0 text-[11px] text-zinc-600 tabular-nums">
                {fmtTokens(log.inputTokens + log.outputTokens)} tokens
              </div>

              <div
                class="w-16 flex-shrink-0 text-right text-xs font-medium tabular-nums {costColor(
                  log.cost,
                  log.currency,
                )}"
              >
                {fmtCost(log.cost, log.currency)}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-4 py-10 text-center text-sm text-zinc-700"
        >
          暂无记录
        </div>
      {/if}
    </div>
  </div>
</div>
