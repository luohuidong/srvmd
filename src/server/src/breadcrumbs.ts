import type { types } from "../../shared/src/index.js";
import { constants } from "../../shared/src/index.js";

/** Build Home -> ... -> directory breadcrumbs, optionally ending with the current file. */
export function buildBreadcrumbs(
  relativeDirectory: string,
  file?: types.Breadcrumb,
): types.Breadcrumb[] {
  const crumbs: types.Breadcrumb[] = [
    { label: constants.ROOT_LABEL, href: "/" },
  ];
  let href = "/";

  for (const segment of relativeDirectory.split("/").filter(Boolean)) {
    href += `${encodeURIComponent(segment)}/`;
    crumbs.push({ label: segment, href });
  }

  if (file) crumbs.push(file);

  return crumbs;
}
