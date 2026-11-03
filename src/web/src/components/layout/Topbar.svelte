<script lang="ts">
  import type { types } from "@shared";
  import Button from "../Button.svelte";
  import ThemeToggle from "../../features/theme/ThemeToggle.svelte";
  import Breadcrumbs from "./Breadcrumbs.svelte";

  let { crumbs, rawHref }: { crumbs: types.Breadcrumb[]; rawHref?: string } =
    $props();
</script>

<header class="topbar">
  <Breadcrumbs {crumbs} />
  <div class="actions">
    {#if rawHref}
      <Button href={rawHref} title="View Markdown source">Raw</Button>
    {/if}
    <ThemeToggle />
  </div>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 1.25rem;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  @media print {
    .topbar {
      display: none !important;
    }
  }
</style>
