<script lang="ts">
  import Button from "../../components/Button.svelte";
  import type { ThemePreference } from "../../lib/types.ts";
  import { cycleTheme, theme } from "./theme.svelte.ts";

  const labels: Record<ThemePreference, { name: string; next: string }> = {
    light: { name: "Light", next: "Dark" },
    dark: { name: "Dark", next: "System" },
    system: { name: "System", next: "Light" },
  };

  const current = $derived(labels[theme.preference]);
</script>

<Button
  title="Theme: {current.name}. Click to switch to {current.next}."
  label="Theme: {current.name}. Switch to {current.next}."
  onclick={cycleTheme}
>
  {#if theme.preference === "light"}
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      ></circle>
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      ></path>
    </svg>
  {:else if theme.preference === "dark"}
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      ></path>
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect
        x="3"
        y="4.5"
        width="18"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      ></rect>
      <path
        d="M8.5 20h7M12 16.5V20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      ></path>
    </svg>
  {/if}
</Button>
