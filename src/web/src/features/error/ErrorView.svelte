<script lang="ts">
  import { constants } from "@shared";
  import Footer from "../../components/layout/Footer.svelte";
  import PageLayout from "../../components/layout/PageLayout.svelte";
  import Topbar from "../../components/layout/Topbar.svelte";

  let { status, message }: { status: number; message: string } = $props();

  const crumbs = [{ label: constants.ROOT_LABEL, href: "/" }];
</script>

<Topbar {crumbs} />

<PageLayout>
  <div class="error-page">
    <p class="error-code">{status}</p>
    <h1>{status === 404 ? "Page not found" : "Something went wrong"}</h1>
    <p class="error-message">{message}</p>
    <p>
      <a href="/">Go to the root directory</a>
    </p>
  </div>
</PageLayout>

<Footer />

<style>
  .error-page {
    text-align: center;
    padding-top: 3rem;
  }
  .error-code {
    margin: 0;
    font-size: 4.5rem;
    font-weight: 700;
    line-height: 1;
    color: var(--fg-muted);
    opacity: 0.45;
  }
  .error-message {
    color: var(--fg-muted);
  }
</style>
