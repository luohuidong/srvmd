<script lang="ts">
  import { appConfig } from "$lib/config";
  import Footer from "../../components/layout/Footer.svelte";
  import Topbar from "../../components/layout/Topbar.svelte";

  let { status, message }: { status: number; message: string } = $props();

  const crumbs = $derived([{ label: appConfig.rootLabel, href: "/" }]);
</script>

<Topbar {crumbs} />

<div class="layout">
  <main class="content">
    <div class="error-page">
      <p class="error-code">{status}</p>
      <h1>{status === 404 ? "Page not found" : "Something went wrong"}</h1>
      <p class="error-message">{message}</p>
      <p>
        <a href="/">Go to the root directory</a>
      </p>
    </div>
  </main>
</div>

<Footer />
