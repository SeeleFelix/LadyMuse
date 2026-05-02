<script lang="ts">
  interface BrowseImage {
    filename: string;
    relativePath: string;
    size: number;
    modifiedAt: string;
    width: number | null;
    height: number | null;
    metadata: {
      positivePrompts: string[];
      negativePrompts: string[];
      models: string[];
      loras: string[];
      width: number | null;
      height: number | null;
      samplers: any[];
    } | null;
    attributes?: {
      rating: number;
      colorLabel: string | null;
      flag: string | null;
      notes: string | null;
      stackId: number | null;
    } | null;
    tags?: { id: number; name: string; slug: string }[];
  }

  interface Collection {
    id: number;
    name: string;
    isSmart: boolean;
  }

  let {
    x,
    y,
    image,
    selectedCount = 1,
    collections = [],
    onclose,
    onopenlightbox,
    onrate,
    oncolor,
    onflag,
    onaddtocollection,
    oncopyprompt,
    oncopyimageurl,
    oncompare,
    ondelete,
  }: {
    x: number;
    y: number;
    image: BrowseImage | null;
    selectedCount?: number;
    collections?: Collection[];
    onclose: () => void;
    onopenlightbox: () => void;
    onrate: (rating: number) => void;
    oncolor: (color: string | null) => void;
    onflag: (flag: string | null) => void;
    onaddtocollection: (collectionId: number) => void;
    oncopyprompt: () => void;
    oncopyimageurl: () => void;
    oncompare: () => void;
    ondelete: () => void;
  } = $props();

  let openSubmenu = $state<string | null>(null);
  let submenuTimeout: ReturnType<typeof setTimeout> | null = null;
  let menuEl: HTMLDivElement | undefined = $state();
  let adjustedX = $state(0);
  let adjustedY = $state(0);
  let flipSubmenu = $state(false);

  const colorMap: Record<string, string> = {
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };

  const isMulti = $derived(selectedCount > 1);
  const currentRating = $derived(image?.attributes?.rating ?? 0);
  const hasPrompt = $derived(!!image?.metadata?.positivePrompts?.length);

  $effect(() => {
    if (menuEl) {
      const rect = menuEl.getBoundingClientRect();
      let ax = x;
      let ay = y;
      if (x + rect.width > window.innerWidth)
        ax = window.innerWidth - rect.width - 8;
      if (y + rect.height > window.innerHeight)
        ay = window.innerHeight - rect.height - 8;
      adjustedX = Math.max(8, ax);
      adjustedY = Math.max(8, ay);
      flipSubmenu = adjustedX + rect.width + 160 > window.innerWidth;
    }
  });

  function scheduleSubmenu(key: string) {
    return () => {
      if (submenuTimeout) clearTimeout(submenuTimeout);
      submenuTimeout = setTimeout(() => {
        openSubmenu = key;
      }, 120);
    };
  }

  function cancelSubmenu() {
    if (submenuTimeout) {
      clearTimeout(submenuTimeout);
      submenuTimeout = null;
    }
    openSubmenu = null;
  }

  function keepSubmenu(key: string) {
    if (submenuTimeout) {
      clearTimeout(submenuTimeout);
      submenuTimeout = null;
    }
    openSubmenu = key;
  }
</script>

<!-- Invisible backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[54]"
  onclick={onclose}
  oncontextmenu={(e) => {
    e.preventDefault();
    onclose();
  }}
></div>

<!-- Menu panel -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={menuEl}
  class="fixed z-[55] bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl py-1 min-w-[200px] select-none"
  style="left:{adjustedX}px; top:{adjustedY}px;"
  onmouseleave={cancelSubmenu}
>
  {#if isMulti}
    <!-- Multi-select menu -->
    <!-- Rate submenu -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative"
      onmouseenter={scheduleSubmenu("rate")}
      onmouseleave={cancelSubmenu}
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        <svg
          class="w-3.5 h-3.5 text-amber-400 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
        <span class="flex-1">评分 ({selectedCount})</span>
        <svg
          class="w-3 h-3 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {#if openSubmenu === "rate"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute {flipSubmenu
            ? 'right-full mr-1'
            : 'left-full ml-1'} top-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]"
          onmouseenter={() => keepSubmenu("rate")}
          onmouseleave={cancelSubmenu}
        >
          {#each [1, 2, 3, 4, 5] as r}
            <button
              onclick={() => onrate(r)}
              class="flex items-center gap-1.5 w-full px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
            >
              {#each [1, 2, 3, 4, 5] as s}
                <span class={s <= r ? "text-amber-400" : "text-zinc-600"}
                  >★</span
                >
              {/each}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Color submenu -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative"
      onmouseenter={scheduleSubmenu("color")}
      onmouseleave={cancelSubmenu}
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        <svg
          class="w-3.5 h-3.5 text-zinc-400 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="10" cy="10" r="8" />
        </svg>
        <span class="flex-1">颜色标记 ({selectedCount})</span>
        <svg
          class="w-3 h-3 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {#if openSubmenu === "color"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute {flipSubmenu
            ? 'right-full mr-1'
            : 'left-full ml-1'} top-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[130px]"
          onmouseenter={() => keepSubmenu("color")}
          onmouseleave={cancelSubmenu}
        >
          <button
            onclick={() => oncolor(null)}
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
          >
            <span class="w-3 h-3 rounded-full border border-zinc-600"></span>
            <span>无</span>
          </button>
          {#each [["red", "红色"], ["yellow", "黄色"], ["green", "绿色"], ["blue", "蓝色"], ["purple", "紫色"]] as [key, label]}
            <button
              onclick={() => oncolor(key)}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
            >
              <span class="w-3 h-3 rounded-full {colorMap[key]}"></span>
              <span>{label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Flag submenu -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative"
      onmouseenter={scheduleSubmenu("flag")}
      onmouseleave={cancelSubmenu}
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        <svg
          class="w-3.5 h-3.5 text-zinc-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
          />
        </svg>
        <span class="flex-1">标记 ({selectedCount})</span>
        <svg
          class="w-3 h-3 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {#if openSubmenu === "flag"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute {flipSubmenu
            ? 'right-full mr-1'
            : 'left-full ml-1'} top-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]"
          onmouseenter={() => keepSubmenu("flag")}
          onmouseleave={cancelSubmenu}
        >
          <button
            onclick={() => onflag("pick")}
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-green-400 hover:bg-zinc-700 text-left"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Pick
          </button>
          <button
            onclick={() => onflag("reject")}
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700 text-left"
          >
            <svg
              class="w-3.5 h-3.5"
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
            Reject
          </button>
          <button
            onclick={() => onflag(null)}
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-700 text-left"
          >
            <svg
              class="w-3.5 h-3.5"
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
            清除
          </button>
        </div>
      {/if}
    </div>

    <!-- Add to collection submenu -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative"
      onmouseenter={scheduleSubmenu("collection")}
      onmouseleave={cancelSubmenu}
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        <svg
          class="w-3.5 h-3.5 text-violet-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <span class="flex-1">加入收藏集</span>
        <svg
          class="w-3 h-3 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {#if openSubmenu === "collection"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute {flipSubmenu
            ? 'right-full mr-1'
            : 'left-full ml-1'} top-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px] max-h-[200px] overflow-y-auto"
          onmouseenter={() => keepSubmenu("collection")}
          onmouseleave={cancelSubmenu}
        >
          {#each collections.filter((c) => !c.isSmart) as c}
            <button
              onclick={() => onaddtocollection(c.id)}
              class="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              {c.name}
            </button>
          {/each}
          {#if collections.filter((c) => !c.isSmart).length === 0}
            <span class="block px-3 py-1.5 text-xs text-zinc-600">无收藏集</span
            >
          {/if}
        </div>
      {/if}
    </div>

    <!-- Compare -->
    {#if selectedCount >= 2 && selectedCount <= 4}
      <button
        onclick={oncompare}
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        <svg
          class="w-3.5 h-3.5 text-zinc-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <span>对比 ({selectedCount})</span>
      </button>
    {/if}

    <div class="border-t border-zinc-700 my-1 mx-2"></div>

    <!-- Delete -->
    <button
      onclick={ondelete}
      class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 text-left"
    >
      <svg
        class="w-3.5 h-3.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      <span>删除 ({selectedCount})</span>
    </button>
  {:else}
    <!-- Single image menu -->
    <!-- Open in lightbox -->
    <button
      onclick={onopenlightbox}
      class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
    >
      <svg
        class="w-3.5 h-3.5 text-zinc-400 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
        />
      </svg>
      <span>查看大图</span>
    </button>

    <!-- Rate submenu -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative"
      onmouseenter={scheduleSubmenu("rate")}
      onmouseleave={cancelSubmenu}
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        <svg
          class="w-3.5 h-3.5 text-amber-400 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
        <span class="flex-1">评分</span>
        <span class="text-zinc-500 mr-1"
          >{currentRating > 0 ? "★".repeat(currentRating) : ""}</span
        >
        <svg
          class="w-3 h-3 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {#if openSubmenu === "rate"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute {flipSubmenu
            ? 'right-full mr-1'
            : 'left-full ml-1'} top-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]"
          onmouseenter={() => keepSubmenu("rate")}
          onmouseleave={cancelSubmenu}
        >
          {#each [1, 2, 3, 4, 5] as r}
            <button
              onclick={() => onrate(r)}
              class="flex items-center gap-1.5 w-full px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
            >
              {#each [1, 2, 3, 4, 5] as s}
                <span class={s <= r ? "text-amber-400" : "text-zinc-600"}
                  >★</span
                >
              {/each}
              {#if r === currentRating}
                <span class="text-violet-400 ml-1">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Color submenu -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative"
      onmouseenter={scheduleSubmenu("color")}
      onmouseleave={cancelSubmenu}
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        {#if image?.attributes?.colorLabel}
          <span
            class="w-3.5 h-3.5 rounded-full shrink-0 {colorMap[
              image.attributes.colorLabel
            ] || 'bg-zinc-400'}"
          ></span>
        {:else}
          <svg
            class="w-3.5 h-3.5 text-zinc-400 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <circle cx="10" cy="10" r="8" />
          </svg>
        {/if}
        <span class="flex-1">颜色标记</span>
        <svg
          class="w-3 h-3 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {#if openSubmenu === "color"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute {flipSubmenu
            ? 'right-full mr-1'
            : 'left-full ml-1'} top-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[130px]"
          onmouseenter={() => keepSubmenu("color")}
          onmouseleave={cancelSubmenu}
        >
          <button
            onclick={() => oncolor(null)}
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
          >
            <span class="w-3 h-3 rounded-full border border-zinc-600"></span>
            <span>无</span>
          </button>
          {#each [["red", "红色"], ["yellow", "黄色"], ["green", "绿色"], ["blue", "蓝色"], ["purple", "紫色"]] as [key, label]}
            <button
              onclick={() => oncolor(key)}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
            >
              <span class="w-3 h-3 rounded-full {colorMap[key]}"></span>
              <span>{label}</span>
              {#if image?.attributes?.colorLabel === key}
                <span class="text-violet-400 ml-auto">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Flag submenu -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative"
      onmouseenter={scheduleSubmenu("flag")}
      onmouseleave={cancelSubmenu}
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        <svg
          class="w-3.5 h-3.5 text-zinc-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
          />
        </svg>
        <span class="flex-1">标记</span>
        {#if image?.attributes?.flag === "pick"}
          <span class="text-green-400 text-[10px]">P</span>
        {:else if image?.attributes?.flag === "reject"}
          <span class="text-red-400 text-[10px]">R</span>
        {/if}
        <svg
          class="w-3 h-3 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {#if openSubmenu === "flag"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute {flipSubmenu
            ? 'right-full mr-1'
            : 'left-full ml-1'} top-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]"
          onmouseenter={() => keepSubmenu("flag")}
          onmouseleave={cancelSubmenu}
        >
          <button
            onclick={() => onflag("pick")}
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
          >
            <svg
              class="w-3.5 h-3.5 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Pick
            {#if image?.attributes?.flag === "pick"}
              <span class="text-violet-400 ml-auto">✓</span>
            {/if}
          </button>
          <button
            onclick={() => onflag("reject")}
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
          >
            <svg
              class="w-3.5 h-3.5 text-red-400"
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
            Reject
            {#if image?.attributes?.flag === "reject"}
              <span class="text-violet-400 ml-auto">✓</span>
            {/if}
          </button>
          <button
            onclick={() => onflag(null)}
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-700 text-left"
          >
            <svg
              class="w-3.5 h-3.5"
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
            清除
          </button>
        </div>
      {/if}
    </div>

    <!-- Add to collection submenu -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative"
      onmouseenter={scheduleSubmenu("collection")}
      onmouseleave={cancelSubmenu}
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
      >
        <svg
          class="w-3.5 h-3.5 text-violet-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <span class="flex-1">加入收藏集</span>
        <svg
          class="w-3 h-3 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {#if openSubmenu === "collection"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute {flipSubmenu
            ? 'right-full mr-1'
            : 'left-full ml-1'} top-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px] max-h-[200px] overflow-y-auto"
          onmouseenter={() => keepSubmenu("collection")}
          onmouseleave={cancelSubmenu}
        >
          {#each collections.filter((c) => !c.isSmart) as c}
            <button
              onclick={() => onaddtocollection(c.id)}
              class="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              {c.name}
            </button>
          {/each}
          {#if collections.filter((c) => !c.isSmart).length === 0}
            <span class="block px-3 py-1.5 text-xs text-zinc-600">无收藏集</span
            >
          {/if}
        </div>
      {/if}
    </div>

    <div class="border-t border-zinc-700 my-1 mx-2"></div>

    <!-- Copy prompt -->
    <button
      onclick={oncopyprompt}
      disabled={!hasPrompt}
      class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left {!hasPrompt
        ? 'opacity-40 cursor-not-allowed pointer-events-none'
        : ''}"
    >
      <svg
        class="w-3.5 h-3.5 text-zinc-400 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      <span>复制提示词</span>
    </button>

    <!-- Copy image URL -->
    <button
      onclick={oncopyimageurl}
      class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
    >
      <svg
        class="w-3.5 h-3.5 text-zinc-400 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      <span>复制图片链接</span>
    </button>

    <div class="border-t border-zinc-700 my-1 mx-2"></div>

    <!-- Delete -->
    <button
      onclick={ondelete}
      class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 text-left"
    >
      <svg
        class="w-3.5 h-3.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      <span>删除</span>
    </button>
  {/if}
</div>
