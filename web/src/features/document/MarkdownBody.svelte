<script lang="ts">
  import type { MermaidSource } from "@shared/types.ts";
  import { mermaidSlots } from "../mermaid/slots.ts";

  let { html, diagrams }: { html: string; diagrams: MermaidSource[] } =
    $props();
</script>

<div class="markdown-body" use:mermaidSlots={diagrams}>
  {@html html}
</div>
