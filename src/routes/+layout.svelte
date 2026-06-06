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
    { href: "/generations", label: "图库", icon: "◈" },
    { href: "/inspiration", label: "灵感", icon: "✦" },
    { href: "/settings", label: "设置", icon: "⚙" },
    { href: "/danbooru", label: "Danbooru", icon: "◇" },
    { href: "/usage", label: "用量", icon: "◎" },
  ];
</script>

<div class="flex h-screen bg-zinc-950 text-zinc-100">
  <aside
    class="flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200 {sidebarOpen
      ? 'w-56'
      : 'w-14'}"
  >
    <div
      class="flex h-14 items-center justify-between border-b border-zinc-800 px-4"
    >
      {#if sidebarOpen}
        <span class="text-lg font-bold text-violet-400">LadyMuse</span>
      {/if}
      <button
        onclick={() => (sidebarOpen = !sidebarOpen)}
        class="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        title={sidebarOpen ? "收起菜单" : "展开菜单"}
      >
        <svg
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {#if sidebarOpen}
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          {:else}
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          {/if}
        </svg>
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
