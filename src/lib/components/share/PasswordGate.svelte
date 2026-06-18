<script lang="ts">
  let password = "";
  let error = "";
  let loading = false;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!password) return;

    loading = true;
    error = "";

    try {
      const res = await fetch("/api/share/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        error = "密码错误";
      }
    } catch {
      error = "网络错误，请重试";
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-zinc-950">
  <form
    onsubmit={handleSubmit}
    class="w-full max-w-sm mx-4 p-8 rounded-xl bg-zinc-900 border border-zinc-800 space-y-6"
  >
    <div class="text-center">
      <h1 class="text-xl font-semibold text-zinc-100">需要密码</h1>
      <p class="text-sm text-zinc-500 mt-1">输入密码以查看分享内容</p>
    </div>

    <div class="space-y-3">
      <input
        type="password"
        bind:value={password}
        placeholder="密码"
        autocomplete="off"
        disabled={loading}
        class="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-center"
      />

      {#if error}
        <p class="text-red-400 text-sm text-center">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="w-full py-2.5 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
      >
        {loading ? "验证中..." : "确认"}
      </button>
    </div>
  </form>
</div>
