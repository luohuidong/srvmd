<script lang="ts">
  import type { DirectoryPayload } from "@shared/contracts.ts";
  import Footer from "../../components/layout/Footer.svelte";
  import Topbar from "../../components/layout/Topbar.svelte";
  import EntryList from "./EntryList.svelte";

  let { page }: { page: DirectoryPayload } = $props();
</script>

<Topbar crumbs={page.breadcrumbs} />

<div class="layout">
  <main class="content">
    <div class="listing">
      <h1>{page.heading}</h1>
      <EntryList entries={page.entries} parentHref={page.parentHref} />
    </div>
  </main>
</div>

<Footer />
