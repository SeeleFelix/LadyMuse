<script lang="ts">
  let {
    message = "",
    type = "info",
    duration = 3000,
    ondismiss,
  }: {
    message: string;
    type?: "info" | "success" | "error";
    duration?: number;
    ondismiss: () => void;
  } = $props();

  const colorMap = {
    info: "bg-zinc-800 text-zinc-200 border-zinc-700",
    success: "bg-green-900/50 text-green-300 border-green-700/50",
    error: "bg-red-900/50 text-red-300 border-red-700/50",
  };

  setTimeout(ondismiss, duration);
</script>

<div class="fixed bottom-6 right-6 z-[70] animate-in slide-in-from-bottom-2">
  <div class="rounded-lg border px-4 py-3 shadow-lg {colorMap[type]}">
    <div class="flex items-center gap-3">
      <span class="text-sm">{message}</span>
      <button onclick={ondismiss} class="text-zinc-400 hover:text-white text-xs"
        >✕</button
      >
    </div>
  </div>
</div>
