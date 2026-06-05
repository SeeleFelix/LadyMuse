<script lang="ts">
  import type { GalleryStore } from "$lib/stores/gallery-store";

  let { store }: { store: GalleryStore } = $props();

  function handleKeydown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      if (e.key !== "Escape") return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    switch (e.key) {
      case "g":
      case "G":
        if (!ctrl) {
          e.preventDefault();
          store.setViewMode("library");
        }
        break;
      case "e":
      case "E":
        if (!ctrl) {
          e.preventDefault();
          store.setViewMode("inspect");
        }
        break;
      case "c":
      case "C":
        if (!ctrl) {
          e.preventDefault();
          store.setViewMode("compare");
        }
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        if (!ctrl && store.activeImage) {
          e.preventDefault();
          store.updateAttributes(store.activeImage.relativePath, {
            rating: parseInt(e.key),
          });
        }
        break;
      case "0":
        if (!ctrl && store.activeImage) {
          e.preventDefault();
          store.updateAttributes(store.activeImage.relativePath, { rating: 0 });
        }
        break;
      case "p":
      case "P":
        if (!ctrl && store.activeImage) {
          e.preventDefault();
          store.updateAttributes(store.activeImage.relativePath, {
            flag: "pick",
          });
        }
        break;
      case "x":
      case "X":
        if (!ctrl && store.activeImage) {
          e.preventDefault();
          store.updateAttributes(store.activeImage.relativePath, {
            flag: "reject",
          });
        }
        break;
      case "u":
      case "U":
        if (!ctrl && store.activeImage) {
          e.preventDefault();
          store.updateAttributes(store.activeImage.relativePath, {
            flag: null,
          });
        }
        break;
      case "a":
      case "A":
        if (ctrl && !shift) {
          e.preventDefault();
          store.selectAll();
        } else if (ctrl && shift) {
          e.preventDefault();
          store.deselectAll();
        }
        break;
      case "i":
      case "I":
        if (ctrl && shift) {
          e.preventDefault();
          store.invertSelection();
        }
        break;
      case "Escape":
        store.deselectAll();
        break;
      case "ArrowLeft":
        if (!ctrl) {
          e.preventDefault();
          navigateImage(-1);
        }
        break;
      case "ArrowRight":
        if (!ctrl) {
          e.preventDefault();
          navigateImage(1);
        }
        break;
      case "Home":
        if (store.images.length > 0) navigateToIndex(0);
        break;
      case "End":
        if (store.images.length > 0) navigateToIndex(store.images.length - 1);
        break;
    }
  }

  function navigateImage(delta: number) {
    if (!store.activeImage || store.images.length === 0) return;
    const idx = store.images.findIndex(
      (img) => img.relativePath === store.activeImage!.relativePath,
    );
    const newIdx = Math.max(0, Math.min(store.images.length - 1, idx + delta));
    navigateToIndex(newIdx);
  }

  function navigateToIndex(idx: number) {
    const img = store.images[idx];
    if (img) {
      store.select(img.relativePath, false, false, -1);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />
