<script lang="ts">
  import { onMount } from "svelte";
  import type { PagePayload } from "@shared/contracts.ts";
  import { ApiError, fetchPage } from "$lib/api";
  import { appConfig } from "$lib/config";
  import LoadingView from "./components/layout/LoadingView.svelte";
  import DirectoryPage from "./features/directory/DirectoryPage.svelte";
  import DocumentPage from "./features/document/DocumentPage.svelte";
  import ErrorView from "./features/error/ErrorView.svelte";
  import {
    connectLive,
    isPageAffected,
    isStylesheet,
  } from "./features/live/live.ts";
  import MermaidViewer from "./features/mermaid/MermaidViewer.svelte";
  import { closeViewer } from "./features/mermaid/viewer.svelte.ts";

  type AppState =
    | { status: "loading" }
    | { status: "error"; code: number; message: string }
    | { status: "ready"; page: PagePayload };

  let state = $state<AppState>({ status: "loading" });
  let request: AbortController | null = null;
  let revision = 0;
  let etag: string | null = null;

  const path = window.location.pathname;

  const title = $derived.by(() => {
    if (state.status === "error") return String(state.code);
    if (state.status !== "ready") return "srvmd";
    if (state.page.kind === "document") return state.page.title;
    if (state.page.kind === "directory") return state.page.heading;
    return "srvmd";
  });

  function applyLang(page: PagePayload): void {
    if (page.kind === "document")
      document.documentElement.lang = page.lang ?? "en";
    else if (page.kind === "directory") document.documentElement.lang = "en";
  }

  async function load(background = false): Promise<void> {
    request?.abort();

    const controller = new AbortController();
    request = controller;
    const current = ++revision;

    if (!background) state = { status: "loading" };

    try {
      const result = await fetchPage(path, {
        signal: controller.signal,
        etag: state.status === "ready" ? etag : null,
      });
      if (current !== revision) return;
      if (result.status === "not-modified") {
        etag = result.etag ?? etag;
        return;
      }

      const page = result.page;
      etag = result.etag;

      if (page.kind === "redirect") {
        window.location.replace(page.location);
        return;
      }

      if (background) closeViewer();
      state = { status: "ready", page };
      applyLang(page);
    } catch (error) {
      if (controller.signal.aborted || current !== revision) return;

      const code = error instanceof ApiError ? error.status : 500;
      const message = error instanceof Error ? error.message : String(error);
      state = { status: "error", code, message };
    }
  }

  onMount(() => {
    void load();

    const disconnect = appConfig.live
      ? connectLive((event) => {
          // A stylesheet may be linked from raw HTML, so force a full reload
          // instead of a conditional page-data request.
          if (event.files.some(isStylesheet)) {
            window.location.reload();
            return;
          }

          const kind = state.status === "ready" ? state.page.kind : null;
          const affected =
            appConfig.single || isPageAffected(path, event.files, kind);
          if (!affected) return;

          void load(true);
        })
      : undefined;

    return () => {
      request?.abort();
      disconnect?.();
    };
  });
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

{#if state.status === "loading"}
  <LoadingView />
{:else if state.status === "error"}
  <ErrorView status={state.code} message={state.message} />
{:else if state.page.kind === "document"}
  <DocumentPage page={state.page} />
{:else if state.page.kind === "directory"}
  <DirectoryPage page={state.page} />
{:else}
  <LoadingView />
{/if}

<MermaidViewer />
