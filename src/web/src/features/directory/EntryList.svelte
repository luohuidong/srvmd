<script lang="ts">
  import type { types } from "@shared";
  import { formatBytes, formatDate } from "$lib/format";

  let {
    entries,
    parentHref,
  }: { entries: types.DirEntry[]; parentHref?: string } = $props();

  function hrefFor(entry: types.DirEntry): string {
    const encoded = encodeURIComponent(entry.name);
    return entry.kind === "dir" ? `${encoded}/` : encoded;
  }

  function iconFor(entry: types.DirEntry): string {
    if (entry.kind === "dir") return "📁";
    return entry.kind === "markdown" ? "📝" : "📄";
  }

  function metaFor(entry: types.DirEntry): string {
    const meta: string[] = [];
    if (entry.size != null && entry.kind !== "dir")
      meta.push(formatBytes(entry.size));
    if (entry.mtime) meta.push(formatDate(entry.mtime));
    return meta.join(" · ");
  }
</script>

<ul class="entries">
  {#if parentHref}
    <li class="entry entry-dir">
      <span class="entry-icon">↩</span>
      <a href={parentHref}>..</a>
    </li>
  {/if}

  {#each entries as entry (entry.name)}
    <li class={`entry entry-${entry.kind}`}>
      <span class="entry-icon" aria-hidden="true">{iconFor(entry)}</span>
      <a class="entry-name" href={hrefFor(entry)}>
        {entry.name}{entry.kind === "dir" ? "/" : ""}
      </a>
      {#if entry.kind === "markdown"}
        <a class="raw-link" href={`${hrefFor(entry)}?raw`} title="View source"
          >raw</a
        >
      {/if}
      <span class="entry-meta">{metaFor(entry)}</span>
    </li>
  {/each}
</ul>

{#if entries.length === 0 && !parentHref}
  <p class="empty">This directory is empty.</p>
{/if}

<style>
  .entries {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .entry {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.8rem;
    border-top: 1px solid var(--border);
  }
  .entry:first-child {
    border-top: 0;
  }
  .entry:hover {
    background: var(--bg-subtle);
  }
  .entry-icon {
    width: 1.3rem;
    text-align: center;
    flex: none;
  }
  .entry-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entry-dir .entry-name {
    font-weight: 600;
  }
  .raw-link {
    flex: none;
    font-size: 0.75rem;
    color: var(--fg-muted);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.05rem 0.35rem;
  }
  .raw-link:hover {
    color: var(--accent);
    text-decoration: none;
  }
  .entry-meta {
    flex: none;
    font-size: 0.78rem;
    color: var(--fg-muted);
    font-variant-numeric: tabular-nums;
  }
  .empty {
    color: var(--fg-muted);
  }
  @media print {
    .raw-link {
      display: none !important;
    }
  }
</style>
