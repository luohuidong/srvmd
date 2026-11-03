<script lang="ts">
  import type { types } from "@shared";

  let { items }: { items: types.SiblingDocument[] } = $props();
</script>

{#if items.length > 0}
  <nav class="siblings" aria-label="Markdown files in this directory">
    <p class="siblings-title">In this directory</p>
    <ul>
      {#each items as item (item.href)}
        <li>
          <a
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            title={item.name}
          >
            {item.name}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
{/if}

<style>
  .siblings {
    display: none;
    font-size: 0.85rem;
  }
  @media (min-width: 1020px) {
    .siblings {
      display: block;
      position: sticky;
      top: 4.2rem;
      align-self: start;
      max-height: calc(100vh - 6rem);
      overflow: auto;
    }
  }
  .siblings-title {
    margin: 0 0 0.5rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  .siblings ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .siblings li {
    margin: 0.1rem 0;
  }
  .siblings a {
    display: block;
    padding: 0.15rem 0.6rem;
    color: var(--fg-muted);
    border-left: 2px solid transparent;
    border-radius: 0 4px 4px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .siblings a:hover {
    color: var(--fg);
    background: var(--bg-subtle);
    text-decoration: none;
  }
  .siblings a[aria-current="page"] {
    color: var(--fg);
    background: var(--bg-subtle);
    border-left-color: var(--accent);
    font-weight: 600;
  }
  @media print {
    .siblings {
      display: none !important;
    }
  }
</style>
