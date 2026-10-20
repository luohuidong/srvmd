<script lang="ts">
  import type { DocumentPayload } from "@shared/contracts.ts";
  import Footer from "../../components/layout/Footer.svelte";
  import Topbar from "../../components/layout/Topbar.svelte";
  import MarkdownBody from "./MarkdownBody.svelte";
  import Toc from "./Toc.svelte";

  let { page }: { page: DocumentPayload } = $props();

  const tocItems = $derived(
    page.toc.filter((item) => item.level >= 2 && item.level <= 4),
  );
</script>

<Topbar crumbs={page.breadcrumbs} rawHref={page.rawHref} />

<div class="layout" class:has-toc={tocItems.length >= 2}>
  <Toc items={page.toc} />
  <main class="content">
    {#if page.warning}
      <div class="warning">{page.warning}</div>
    {/if}
    <MarkdownBody html={page.html} diagrams={page.mermaid} />
  </main>
</div>

<Footer />
