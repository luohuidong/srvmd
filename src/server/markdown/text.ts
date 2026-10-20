const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: "\u00a0",
};

/** Decode HTML entities emitted by Bun's markdown renderer. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]+);/gi, (match, name: string) => {
    const lower = name.toLowerCase();

    if (lower.startsWith("#x") || lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(lower.startsWith("#x") ? 2 : 1), lower.startsWith("#x") ? 16 : 10);
      if (!Number.isFinite(code)) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }

    return ENTITIES[lower] ?? match;
  });
}

export function stripTags(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, ""));
}
