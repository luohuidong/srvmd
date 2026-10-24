<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { theme } from "../theme/theme.svelte.ts";
  import { renderDiagram } from "./render.ts";
  import { closeViewer, viewer } from "./viewer.svelte.ts";
  import {
    fitState,
    panBy,
    zoomAt,
    zoomBy,
    type ViewState,
  } from "./viewport.ts";
  import { nonPassiveWheel } from "./wheel.ts";

  let dialog = $state<HTMLDialogElement>();
  let viewport = $state<HTMLElement>();
  let stage = $state<HTMLDivElement>();
  let view = $state<ViewState | null>(null);
  let svg = $state("");
  let loading = $state(false);
  let error = $state("");
  let dragging = $state(false);
  let token = 0;

  const pointers = new Map<number, { x: number; y: number }>();
  let lastPoint: { x: number; y: number } | null = null;
  let pinch: { x: number; y: number; distance: number } | null = null;

  const stageStyle = $derived(
    view
      ? `width:${view.width * view.scale}px;height:${view.height * view.scale}px;transform:translate(${view.x}px, ${view.y}px)`
      : undefined,
  );
  const zoomLabel = $derived(`${Math.round((view?.scale ?? 1) * 100)}%`);

  function messageOf(cause: unknown): string {
    const message = cause instanceof Error ? cause.message : String(cause);
    return message.length > 320 ? `${message.slice(0, 317)}...` : message;
  }

  function nextFrame(callback: () => void): void {
    if (typeof requestAnimationFrame === "function")
      requestAnimationFrame(callback);
    else setTimeout(callback, 0);
  }

  function measureSvg(markup: string): { width: number; height: number } {
    const documentNode = new DOMParser().parseFromString(
      markup,
      "image/svg+xml",
    );
    const root = documentNode.documentElement;
    const viewBox =
      root.getAttribute("viewBox") ?? root.getAttribute("viewbox");

    if (viewBox) {
      const values = viewBox.split(/[\s,]+/).map(Number);
      const width = values[2];
      const height = values[3];
      if (width && height && Number.isFinite(width) && Number.isFinite(height))
        return { width, height };
    }

    const width = Number.parseFloat(root.getAttribute("width") ?? "");
    const height = Number.parseFloat(root.getAttribute("height") ?? "");
    return {
      width: Number.isFinite(width) && width > 0 ? width : 800,
      height: Number.isFinite(height) && height > 0 ? height : 600,
    };
  }

  function fitToViewport(): void {
    if (!view || !viewport) return;
    view = fitState(
      view.width,
      view.height,
      viewport.clientWidth,
      viewport.clientHeight,
    );
  }

  function zoom(factor: number): void {
    if (!view || !viewport) return;
    view = zoomBy(view, viewport.clientWidth, viewport.clientHeight, factor);
  }

  function close(): void {
    if (!dialog?.open) {
      closeViewer();
      return;
    }

    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.open = false;
      handleClose();
    }
  }

  function handleClose(): void {
    token++;
    closeViewer();
    svg = "";
    view = null;
    error = "";
    loading = false;
    dragging = false;
    pointers.clear();
    lastPoint = null;
    pinch = null;
    document.documentElement.classList.remove("mermaid-modal-open");
  }

  function onWheel(event: WheelEvent): void {
    if (!view || !viewport) return;
    event.preventDefault();

    const rect = viewport.getBoundingClientRect();
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= viewport.clientHeight;

    view = zoomAt(
      view,
      event.clientX - rect.left,
      event.clientY - rect.top,
      view.scale * Math.exp(-delta * 0.0015),
    );
  }

  function gesture(): { x: number; y: number; distance: number } | null {
    const points = [...pointers.values()];
    const a = points[0];
    const b = points[1];
    if (!a || !b) return null;

    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    };
  }

  function onPointerDown(event: PointerEvent): void {
    if (!viewport || !view) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    dragging = true;

    if (pointers.size >= 2) {
      pinch = gesture();
      lastPoint = null;
    } else {
      lastPoint = { x: event.clientX, y: event.clientY };
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!viewport || !view || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      const next = gesture();
      if (pinch && next) {
        const rect = viewport.getBoundingClientRect();
        view = zoomAt(
          view,
          next.x - rect.left,
          next.y - rect.top,
          view.scale * (next.distance / pinch.distance),
        );
        view = panBy(view, next.x - pinch.x, next.y - pinch.y);
      }
      pinch = next;
      lastPoint = null;
      return;
    }

    const point = pointers.get(event.pointerId);
    if (lastPoint && point) {
      view = panBy(view, point.x - lastPoint.x, point.y - lastPoint.y);
      lastPoint = point;
    }
  }

  function releasePointer(event: PointerEvent): void {
    if (!viewport || !pointers.has(event.pointerId)) return;

    pointers.delete(event.pointerId);

    if (viewport.hasPointerCapture(event.pointerId)) {
      try {
        viewport.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore a capture that was already released.
      }
    }

    if (pointers.size === 0) {
      lastPoint = null;
      pinch = null;
      dragging = false;
    } else {
      pinch = null;
      const remaining = [...pointers.values()][0];
      lastPoint = remaining ? { x: remaining.x, y: remaining.y } : null;
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!view || !viewport) return;

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom(1.25);
    } else if (event.key === "-") {
      event.preventDefault();
      zoom(0.8);
    } else if (event.key === "0") {
      event.preventDefault();
      fitToViewport();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      view = panBy(view, 40, 0);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      view = panBy(view, -40, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      view = panBy(view, 0, 40);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      view = panBy(view, 0, -40);
    }
  }

  function onDialogClick(event: MouseEvent): void {
    if (event.target === dialog) close();
  }

  $effect(() => {
    if (!dialog) return;

    if (viewer.open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.open = true;
      }
      document.documentElement.classList.add("mermaid-modal-open");
    } else if (dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else {
        dialog.open = false;
        handleClose();
      }
    }
  });

  $effect(() => {
    const isOpen = viewer.open;
    const source = viewer.source;
    const currentTheme = theme.value;
    if (!isOpen) return;

    const current = ++token;
    const controller = new AbortController();
    loading = true;
    error = "";
    svg = "";
    view = null;

    renderDiagram(source, currentTheme, controller.signal)
      .then((result) => {
        if (current !== token) return;

        const dimensions = measureSvg(result.svg);
        svg = result.svg;
        loading = false;
        view = fitState(dimensions.width, dimensions.height, 800, 600);

        void tick().then(() => {
          if (current !== token) return;
          nextFrame(() => {
            if (current !== token) return;
            if (stage) result.bindFunctions?.(stage);
            fitToViewport();
            viewport?.focus();
          });
        });
      })
      .catch((cause) => {
        if (current !== token || controller.signal.aborted) return;
        loading = false;
        error = messageOf(cause);
      });

    return () => {
      if (current === token) token++;
      controller.abort();
    };
  });

  onDestroy(() => {
    token++;
    document.documentElement.classList.remove("mermaid-modal-open");
  });
</script>

<dialog
  class="mermaid-modal"
  aria-label="Mermaid diagram viewer"
  bind:this={dialog}
  onclose={handleClose}
  onclick={onDialogClick}
  onkeydown={onKeydown}
>
  <div class="mermaid-modal-bar">
    <span class="mermaid-modal-title">Mermaid diagram</span>
    <div class="mermaid-modal-actions">
      <button
        type="button"
        class="mermaid-modal-button"
        aria-label="Zoom out"
        title="Zoom out"
        onclick={() => zoom(0.8)}>−</button
      >
      <span class="mermaid-modal-zoom" aria-live="polite">{zoomLabel}</span>
      <button
        type="button"
        class="mermaid-modal-button"
        aria-label="Zoom in"
        title="Zoom in"
        onclick={() => zoom(1.25)}>+</button
      >
      <button
        type="button"
        class="mermaid-modal-button"
        aria-label="Fit to window"
        title="Fit to window"
        onclick={fitToViewport}>Fit</button
      >
      <button
        type="button"
        class="mermaid-modal-button"
        aria-label="Close"
        title="Close"
        onclick={close}>×</button
      >
    </div>
  </div>

  <div
    class="mermaid-modal-viewport"
    class:is-dragging={dragging}
    role="application"
    aria-label="Mermaid diagram viewport"
    tabindex="-1"
    bind:this={viewport}
    use:nonPassiveWheel={onWheel}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={releasePointer}
    onpointercancel={releasePointer}
    ondblclick={fitToViewport}
  >
    <div class="mermaid-modal-stage" style={stageStyle} bind:this={stage}>
      {#if svg}
        {@html svg}
      {/if}
    </div>
    {#if loading}
      <p class="mermaid-modal-loading">Rendering…</p>
    {/if}
    {#if error}
      <p class="mermaid-modal-error">Mermaid error: {error}</p>
    {/if}
  </div>

  <p class="mermaid-modal-hint">
    Drag to pan · Scroll or pinch to zoom · Esc to close
  </p>
</dialog>
