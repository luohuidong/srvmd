import { APP_ASSET_PREFIX } from "../../../shared/constants.ts";

/** Prebuilt static-page live-reload module, emitted by the Vite build. */
export const LIVE_CLIENT_SCRIPT_PATH = `${APP_ASSET_PREFIX}/live-static.js`;

/** Append the live-reload module to a static HTML document. */
export function injectLiveReload(html: string): string {
  const snippet = `<script type="module" src="${LIVE_CLIENT_SCRIPT_PATH}"></script>`;
  const match = /<\/body\s*>/i.exec(html);
  if (!match || match.index === undefined) return html + snippet;
  return html.slice(0, match.index) + snippet + html.slice(match.index);
}
