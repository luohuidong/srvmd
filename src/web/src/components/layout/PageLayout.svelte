<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    hasLeft = false,
    hasRight = false,
    left,
    right,
    children,
  }: {
    hasLeft?: boolean;
    hasRight?: boolean;
    left?: Snippet;
    right?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div class="layout" class:has-left={hasLeft} class:has-right={hasRight}>
  {#if hasLeft && left}
    {@render left()}
  {/if}
  <main class="content">
    {@render children()}
  </main>
  {#if hasRight && right}
    {@render right()}
  {/if}
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2.5rem;
    max-width: 1320px;
    margin: 0 auto;
    padding: 2.25rem 1.25rem 4rem;
  }
  @media (min-width: 1020px) {
    .layout.has-left {
      grid-template-columns: 230px minmax(0, 1fr);
    }
    .layout.has-right {
      grid-template-columns: minmax(0, 1fr) 230px;
    }
    .layout.has-left.has-right {
      grid-template-columns: 230px minmax(0, 1fr) 230px;
    }
  }
  .content {
    min-width: 0;
  }
  @media print {
    .layout {
      display: block;
      max-width: none;
      padding: 0;
    }
  }
</style>
