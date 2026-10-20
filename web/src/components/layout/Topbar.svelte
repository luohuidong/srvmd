<script lang="ts">
  import type { Breadcrumb } from "@shared/types.ts";
  import ThemeToggle from "../../features/theme/ThemeToggle.svelte";
  import Breadcrumbs from "./Breadcrumbs.svelte";

  let { crumbs, rawHref }: { crumbs: Breadcrumb[]; rawHref?: string } =
    $props();
</script>

<header class="topbar">
  <Breadcrumbs {crumbs} />
  <div class="actions">
    {#if rawHref}
      <a class="btn" href={rawHref} title="View Markdown source">Raw</a>
    {/if}
    <ThemeToggle />
  </div>
</header>
