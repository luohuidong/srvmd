/** Common response headers for every response this server produces. */
export function baseHeaders(cors: boolean): Headers {
  const headers = new Headers();
  headers.set("X-Content-Type-Options", "nosniff");
  if (cors) {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "*");
  }
  return headers;
}
