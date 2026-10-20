<script lang="ts">
  import { appConfig } from "$lib/config";
  import Footer from "./Footer.svelte";
  import Topbar from "./Topbar.svelte";

  const crumbs = $derived([{ label: appConfig.rootLabel, href: "/" }]);
</script>

<Topbar {crumbs} />

<div class="layout">
  <main class="content">
    <p class="loading">Loading…</p>
  </main>
</div>

<Footer />
