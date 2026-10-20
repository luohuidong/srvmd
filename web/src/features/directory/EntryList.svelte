<script lang="ts">
  import type { DirEntry } from "@shared/types.ts";
  import { formatBytes, formatDate } from "$lib/format";

  let { entries, parentHref }: { entries: DirEntry[]; parentHref?: string } =
    $props();

  function hrefFor(entry: DirEntry): string {
    const encoded = encodeURIComponent(entry.name);
    return entry.kind === "dir" ? `${encoded}/` : encoded;
  }

  function iconFor(entry: DirEntry): string {
    if (entry.kind === "dir") return "📁";
    return entry.kind === "markdown" ? "📝" : "📄";
  }

  function metaFor(entry: DirEntry): string {
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
