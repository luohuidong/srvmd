import type { Breadcrumb } from "./types.ts";

/** Build root -> ... -> directory breadcrumbs from a relative directory path. */
export function buildBreadcrumbs(rootLabel: string, relativeDirectory: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: rootLabel, href: "/" }];
  let href = "/";

  for (const segment of relativeDirectory.split("/").filter(Boolean)) {
    href += `${encodeURIComponent(segment)}/`;
    crumbs.push({ label: segment, href });
  }

  return crumbs;
}
