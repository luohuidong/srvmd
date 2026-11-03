import type { MarkdownIt as MarkdownItInstance, Token } from "markdown-it";

/** Matches the marker at the start of the paragraph source. */
const TASK_MARKER_RE = /^\[([ xX])\](?:[ \t]+|$)/;
/** Matches the marker inside the first text token, which is already decoded. */
const TEXT_MARKER_RE = /^\[[ xX]\][ \t]*/;

/**
 * GFM task lists.
 *
 * markdown-it ships no task list support and the community plugin is untyped,
 * so the rule lives here. It rewrites the first text token of a paragraph that
 * directly belongs to a list item, which is also how GFM scopes a task marker.
 */
export function installTaskLists(md: MarkdownItInstance): void {
  md.core.ruler.push("srvmd_task_lists", state => {
    const { tokens } = state;

    for (let index = 0; index < tokens.length; index++) {
      const inline = tokens[index];
      if (inline?.type !== "inline") continue;
      if (tokens[index - 1]?.type !== "paragraph_open") continue;

      const item = tokens[index - 2];
      if (item?.type !== "list_item_open") continue;

      // Validate against the paragraph source so a marker that runs straight
      // into inline markup (`- [x]**bold**`) is not treated as a task, but cut
      // the marker out of the first text token: the label after it may already
      // be split into strong/link/code/html tokens.
      const match = TASK_MARKER_RE.exec(inline.content);
      const text = inline.children?.[0];
      if (!match || text?.type !== "text") continue;

      const checked = match[1]?.toLowerCase() === "x";
      const checkbox = new state.Token("html_inline", "", 0);
      checkbox.content = `<input class="task-list-item-checkbox" type="checkbox" disabled${checked ? " checked" : ""}> `;

      text.content = text.content.replace(TEXT_MARKER_RE, "");
      inline.children?.unshift(checkbox);
      addClass(item, "task-list-item");
      addClass(parentList(tokens, index - 2), "contains-task-list");
    }
  });
}

function addClass(token: Token | undefined, name: string): void {
  if (!token) return;
  const classes = String(token.attrGet("class") ?? "").split(/\s+/);
  if (!classes.includes(name)) token.attrJoin("class", name);
}

/**
 * Parent list of the item ending just before `from`. Skip lists that already
 * closed, otherwise a nested list that ended earlier would be returned for the
 * item that follows it.
 */
function parentList(tokens: readonly Token[], from: number): Token | undefined {
  let depth = 0;
  for (let index = from; index >= 0; index--) {
    const token = tokens[index];
    if (!token) continue;

    if (
      token.type === "bullet_list_close" ||
      token.type === "ordered_list_close"
    ) {
      depth++;
      continue;
    }

    if (
      token.type === "bullet_list_open" ||
      token.type === "ordered_list_open"
    ) {
      if (depth === 0) return token;
      depth--;
    }
  }
  return undefined;
}
