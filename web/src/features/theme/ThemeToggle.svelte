<script lang="ts">
  import { toggleTheme } from "./theme.svelte.ts";
</script>

<button
  class="btn theme-toggle"
  type="button"
  title="Toggle dark mode"
  aria-label="Toggle dark mode"
  onclick={toggleTheme}
>
  <svg
    class="icon-sun"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
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
  <svg
    class="icon-moon"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linejoin="round"
    ></path>
  </svg>
</button>
