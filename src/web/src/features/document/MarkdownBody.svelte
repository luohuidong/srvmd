<script lang="ts">
  import type { types } from "@shared";
  import { mermaidSlots } from "../mermaid/slots.ts";

  let { html, diagrams }: { html: string; diagrams: types.MermaidSource[] } =
    $props();
</script>

<div class="markdown-body" use:mermaidSlots={diagrams}>
  {@html html}
</div>
