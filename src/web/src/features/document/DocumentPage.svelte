<script lang="ts">
  import type { contracts } from "@shared";
  import Footer from "../../components/layout/Footer.svelte";
  import PageLayout from "../../components/layout/PageLayout.svelte";
  import Topbar from "../../components/layout/Topbar.svelte";
  import MarkdownBody from "./MarkdownBody.svelte";
  import SiblingList from "./SiblingList.svelte";
  import Toc from "./Toc.svelte";

  let { page }: { page: contracts.DocumentPayload } = $props();

  const tocItems = $derived(
    page.toc.filter((item) => item.level >= 2 && item.level <= 4),
  );
</script>

<Topbar crumbs={page.breadcrumbs} rawHref={page.rawHref} />

<PageLayout hasLeft={page.siblings.length > 0} hasRight={tocItems.length >= 2}>
  {#snippet left()}
    <SiblingList items={page.siblings} />
  {/snippet}
  {#snippet right()}
    <Toc items={page.toc} />
  {/snippet}
  {#if page.warning}
    <div class="warning">{page.warning}</div>
  {/if}
  <MarkdownBody html={page.html} diagrams={page.mermaid} />
</PageLayout>

<Footer />

<style>
  .warning {
    margin: 0 0 1.25rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid #d4a72c66;
    border-radius: var(--radius);
    background: #d4a72c1a;
    font-size: 0.85rem;
  }
</style>
