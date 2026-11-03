<script lang="ts">
  import { tick } from "svelte";
  import { theme } from "../theme/theme.svelte.ts";
  import { renderDiagram } from "./render.ts";
  import { openViewer } from "./viewer.svelte.ts";

  let { source }: { source: string } = $props();

  let status = $state<"pending" | "rendered" | "error">("pending");
  let svg = $state("");
  let error = $state("");
  let figure = $state<HTMLDivElement>();
  let token = 0;

  function messageOf(cause: unknown): string {
    const message = cause instanceof Error ? cause.message : String(cause);
    return message.length > 320 ? `${message.slice(0, 317)}...` : message;
  }

  $effect(() => {
    const current = ++token;
    const diagram = source;
    const currentTheme = theme.value;
    const controller = new AbortController();

    status = "pending";
    svg = "";
    error = "";

    renderDiagram(diagram, currentTheme, controller.signal)
      .then((result) => {
        if (current !== token) return;
        svg = result.svg;
        status = "rendered";
        void tick().then(() => {
          if (current !== token) return;
          const canvas = figure?.querySelector(".mermaid-canvas");
          if (canvas) result.bindFunctions?.(canvas);
        });
      })
      .catch((cause) => {
        if (current !== token || controller.signal.aborted) return;
        error = messageOf(cause);
        status = "error";
      });

    return () => {
      if (current === token) token++;
      controller.abort();
    };
  });

  function openDiagram(): void {
    if (status !== "rendered") return;
    openViewer(source);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (status !== "rendered") return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDiagram();
  }
</script>

<div
  class="mermaid-figure"
  bind:this={figure}
  data-mermaid-state={status}
  tabindex={status === "rendered" ? 0 : undefined}
  role="button"
  aria-disabled={status !== "rendered"}
  aria-label={status === "rendered"
    ? "Open Mermaid diagram in fullscreen"
    : "Mermaid diagram"}
  onclick={openDiagram}
  onkeydown={handleKeydown}
>
  {#if status === "rendered"}
    <div class="mermaid-canvas">{@html svg}</div>
  {:else}
    <pre class="mermaid-source"><code>{source}</code></pre>
  {/if}

  <div class="mermaid-caption">
    {#if status === "rendered"}
      <span class="mermaid-hint">Click to open fullscreen</span>
    {:else if status === "error"}
      <span class="mermaid-status">Mermaid error: {error}</span>
    {:else}
      <span class="mermaid-pending">Rendering…</span>
    {/if}
  </div>
</div>

<style>
  .mermaid-figure {
    position: relative;
    margin: 0 0 1.25rem;
    padding: 1rem;
    overflow: auto;
    text-align: center;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .mermaid-figure[data-mermaid-state="rendered"] {
    cursor: zoom-in;
  }
  .mermaid-figure[data-mermaid-state="rendered"]:hover {
    border-color: var(--accent);
  }
  .mermaid-figure:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .mermaid-canvas {
    display: flex;
    justify-content: center;
    min-width: 0;
  }
  .mermaid-canvas :global(svg) {
    max-width: 100% !important;
    height: auto;
  }
  .mermaid-source {
    margin: 0;
    padding: 0;
    overflow: auto;
    text-align: left;
    background: transparent;
    border: 0;
  }
  .mermaid-figure[data-mermaid-state="rendered"] .mermaid-source {
    display: none;
  }
  .mermaid-caption {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--fg-muted);
  }
  .mermaid-hint {
    display: none;
  }
  .mermaid-figure[data-mermaid-state="rendered"] .mermaid-hint {
    display: inline;
  }
  .mermaid-pending {
    display: inline;
  }
  .mermaid-status {
    display: block;
    margin-top: 0.5rem;
    color: var(--danger);
    text-align: left;
    white-space: pre-wrap;
    word-break: break-word;
  }
  @media print {
    .mermaid-hint,
    .mermaid-status,
    .mermaid-pending {
      display: none !important;
    }
  }
</style>
