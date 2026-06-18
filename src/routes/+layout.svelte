<script lang="ts">
  import { page } from "$app/stores";
  import "../app.css";

  let { children } = $props();
  let sidebarOpen = $state(true);
  let mobileMenuOpen = $state(false);

  let isShareRoute = $derived($page.url.pathname.startsWith("/share"));

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

{#if isShareRoute}
  <main class="h-screen bg-zinc-950 text-zinc-100 overflow-y-auto">
    {@render children()}
  </main>
{:else}
  <div class="flex h-screen bg-zinc-950 text-zinc-100">
    <!-- Mobile overlay backdrop -->
    {#if mobileMenuOpen}
      <button
        class="fixed inset-0 z-40 bg-black/60 md:hidden"
        onclick={() => (mobileMenuOpen = false)}
        aria-label="关闭菜单"
      ></button>
    {/if}

    <!-- Mobile hamburger button -->
    <button
      class="fixed top-3 left-3 z-50 p-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 md:hidden"
      onclick={() => (mobileMenuOpen = true)}
      aria-label="打开菜单"
    >
      <svg
        class="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>

    <aside
      class="flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200
      {!mobileMenuOpen ? 'hidden' : ''} md:flex
      {sidebarOpen ? 'md:w-56' : 'md:w-14'}
      {mobileMenuOpen ? '!flex fixed left-0 top-0 z-50 h-full w-56' : ''}"
    >
      <div
        class="flex h-14 items-center justify-between border-b border-zinc-800 px-4"
      >
        {#if sidebarOpen || mobileMenuOpen}
          <span class="text-lg font-bold text-violet-400">LadyMuse</span>
        {/if}
        <!-- Mobile close button -->
        <button
          onclick={() => (mobileMenuOpen = false)}
          class="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors md:hidden"
          aria-label="关闭菜单"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <!-- Desktop toggle -->
        <button
          onclick={() => (sidebarOpen = !sidebarOpen)}
          class="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors hidden md:block"
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
            onclick={() => (mobileMenuOpen = false)}
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <span class="text-base">{item.icon}</span>
            {#if sidebarOpen || mobileMenuOpen}
              <span>{item.label}</span>
            {/if}
          </a>
        {/each}
      </nav>
    </aside>

    <main class="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
      {@render children()}
    </main>
  </div>
{/if}
