import type { types } from "@shared";

/** The TOC only shows levels 2-4; a single heading is not worth a sidebar. */
export function selectTocItems(items: types.TocItem[]): types.TocItem[] {
  return items.filter(item => item.level >= 2 && item.level <= 4);
}
