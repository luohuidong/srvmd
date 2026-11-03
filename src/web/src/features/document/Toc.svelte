<script lang="ts">
  import type { types } from "@shared";

  let { items }: { items: types.TocItem[] } = $props();

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
        {@const level = Math.min(item.level - minLevel, 2)}
        <li class:toc-level-1={level === 1} class:toc-level-2={level === 2}>
          <a href={`#${item.id}`}>{item.text}</a>
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .toc {
    display: none;
    font-size: 0.85rem;
  }
  @media (min-width: 1020px) {
    .toc {
      display: block;
      position: sticky;
      top: 4.2rem;
      align-self: start;
      max-height: calc(100vh - 6rem);
      overflow: auto;
    }
  }
  .toc-title {
    margin: 0 0 0.5rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  .toc ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .toc li {
    margin: 0.1rem 0;
  }
  .toc a {
    display: block;
    padding: 0.15rem 0.6rem;
    color: var(--fg-muted);
    border-left: 2px solid transparent;
    border-radius: 0 4px 4px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toc a:hover {
    color: var(--fg);
    background: var(--bg-subtle);
    text-decoration: none;
  }
  .toc .toc-level-1 a {
    padding-left: 1.35rem;
  }
  .toc .toc-level-2 a {
    padding-left: 2.1rem;
  }
  @media print {
    .toc {
      display: none !important;
    }
  }
</style>
