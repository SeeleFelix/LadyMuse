<script lang="ts">
  import "../app.css";

  let { children } = $props();
  let sidebarOpen = $state(true);

  const navItems = [
    { href: "/", label: "首页", icon: "◉" },
    { href: "/chat", label: "创作伙伴", icon: "◈" },
    { href: "/knowledge", label: "知识库", icon: "◈" },
    { href: "/builder", label: "构建器", icon: "⚡" },
    { href: "/styles", label: "风格库", icon: "◆" },
    { href: "/prompts", label: "提示词", icon: "□" },
    { href: "/generations", label: "生成记录", icon: "◈" },
    { href: "/inspiration", label: "灵感", icon: "✦" },
    { href: "/settings", label: "设置", icon: "⚙" },
  ];
</script>

<div class="flex h-screen bg-zinc-950 text-zinc-100">
  <aside
    class="flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200 {sidebarOpen
      ? 'w-56'
      : 'w-14'}"
  >
    <div class="flex h-14 items-center border-b border-zinc-800 px-4">
      <button
        onclick={() => (sidebarOpen = !sidebarOpen)}
        class="text-lg font-bold text-violet-400 hover:text-violet-300"
      >
        {sidebarOpen ? "LadyMuse" : "LM"}
      </button>
    </div>

    <nav class="flex-1 py-2">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <span class="text-base">{item.icon}</span>
          {#if sidebarOpen}
            <span>{item.label}</span>
          {/if}
        </a>
      {/each}
    </nav>
  </aside>

  <main class="flex-1 overflow-y-auto overflow-x-hidden">
    {@render children()}
  </main>
</div>
