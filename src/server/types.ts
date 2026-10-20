import type { Stats } from "node:fs";
import type { DirEntryKind } from "../shared/types.ts";

export type HtmlMode = "filter" | "allow" | "off";

/** A filesystem path that has been validated to live inside the served root. */
export type ResolvedPath = {
  path: string;
  stats: Stats;
  relative: string;
};

export type DirectoryEntry = {
  name: string;
  kind: DirEntryKind;
  size?: number;
  mtime?: Date;
};

export type FrontmatterData = Record<string, unknown>;
