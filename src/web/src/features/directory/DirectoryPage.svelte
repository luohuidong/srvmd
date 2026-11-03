<script lang="ts">
  import type { contracts } from "@shared";
  import Footer from "../../components/layout/Footer.svelte";
  import PageLayout from "../../components/layout/PageLayout.svelte";
  import Topbar from "../../components/layout/Topbar.svelte";
  import EntryList from "./EntryList.svelte";

  let { page }: { page: contracts.DirectoryPayload } = $props();
</script>

<Topbar crumbs={page.breadcrumbs} />

<PageLayout>
  <div class="listing">
    <h1>{page.heading}</h1>
    <EntryList entries={page.entries} parentHref={page.parentHref} />
  </div>
</PageLayout>

<Footer />

<style>
  .listing h1 {
    margin-top: 0;
  }
</style>
