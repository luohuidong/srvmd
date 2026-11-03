<script lang="ts">
  import type { types } from "@shared";

  let { crumbs }: { crumbs: types.Breadcrumb[] } = $props();
</script>

{#if crumbs.length > 0}
  <nav class="crumbs" aria-label="Breadcrumb">
    {#each crumbs as crumb, index (`${crumb.href}:${crumb.label}`)}
      {#if index > 0}<span class="sep">/</span>{/if}
      {#if index === crumbs.length - 1}
        <span aria-current="page">{crumb.label}</span>
      {:else}
        <a href={crumb.href}>{crumb.label}</a>
      {/if}
    {/each}
  </nav>
{/if}

<style>
  .crumbs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--fg-muted);
    min-width: 0;
  }
  .crumbs a {
    color: var(--fg-muted);
  }
  .crumbs a:hover {
    color: var(--accent);
  }
  .crumbs .sep {
    opacity: 0.45;
  }
</style>
