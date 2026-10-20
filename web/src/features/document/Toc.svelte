<script lang="ts">
  import type { TocItem } from "@shared/types.ts";

  let { items }: { items: TocItem[] } = $props();

  const selected = $derived(
    items.filter((item) => item.level >= 2 && item.level <= 4),
  );
  const minLevel = $derived(
    selected.length > 0 ? Math.min(...selected.map((item) => item.level)) : 0,
  );
</script>

{#if selected.length >= 2}
  <aside class="toc" aria-label="Table of contents">
    <p class="toc-title">On this page</p>
    <ul>
      {#each selected as item (item.id)}
        <li class={`toc-level-${Math.min(item.level - minLevel, 2)}`}>
          <a href={`#${item.id}`}>{item.text}</a>
        </li>
      {/each}
    </ul>
  </aside>
{/if}
