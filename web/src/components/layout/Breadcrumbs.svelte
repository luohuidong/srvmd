<script lang="ts">
  import type { Breadcrumb } from "@shared/types.ts";

  let { crumbs }: { crumbs: Breadcrumb[] } = $props();
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
