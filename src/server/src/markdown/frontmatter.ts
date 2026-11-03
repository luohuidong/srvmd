import { parse } from "yaml";

type FrontmatterData = Record<string, unknown>;

type FrontmatterResult = {
  data: FrontmatterData;
  body: string;
  raw?: string;
  error?: string;
};

/** Split a leading YAML frontmatter block from the Markdown body. */
export function parseFrontmatter(source: string): FrontmatterResult {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(
    source,
  );
  if (!match) return { data: {}, body: source };

  const raw = match[1] ?? "";
  let data: FrontmatterData = {};
  let error: string | undefined;

  try {
    const parsed = parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as FrontmatterData;
    }
  } catch (cause) {
    error = `Invalid frontmatter: ${cause instanceof Error ? cause.message : String(cause)}`;
  }

  return { data, body: source.slice(match[0].length), raw, error };
}
