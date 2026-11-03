<script lang="ts">
  import { constants } from "@shared";
  import Footer from "./Footer.svelte";
  import PageLayout from "./PageLayout.svelte";
  import Topbar from "./Topbar.svelte";

  const crumbs = [{ label: constants.ROOT_LABEL, href: "/" }];
</script>

<Topbar {crumbs} />

<PageLayout>
  <p class="loading">Loading…</p>
</PageLayout>

<Footer />

<style>
  .loading {
    color: var(--fg-muted);
  }
</style>
