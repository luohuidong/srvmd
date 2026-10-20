import type { TocItem } from "@shared/types.ts";

/** The TOC only shows levels 2-4; a single heading is not worth a sidebar. */
export function selectTocItems(items: TocItem[]): TocItem[] {
  return items.filter(item => item.level >= 2 && item.level <= 4);
}
