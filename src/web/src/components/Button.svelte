<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    href,
    title,
    label,
    onclick,
    children,
  }: {
    href?: string;
    title?: string;
    label?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

{#if href}
  <a class="btn" {href} {title} aria-label={label}>{@render children()}</a>
{:else}
  <button class="btn" type="button" {title} aria-label={label} {onclick}>
    {@render children()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.6rem;
    font: inherit;
    font-size: 0.8rem;
    color: var(--fg-muted);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }
  .btn:hover {
    color: var(--fg);
    background: var(--bg-subtle);
    text-decoration: none;
  }
</style>
