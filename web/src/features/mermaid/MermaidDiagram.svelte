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

    status = "pending";
    svg = "";
    error = "";

    renderDiagram(diagram, currentTheme)
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
        if (current !== token) return;
        error = messageOf(cause);
        status = "error";
      });

    return () => {
      if (current === token) token++;
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
