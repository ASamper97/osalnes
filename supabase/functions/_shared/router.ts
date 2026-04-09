/**
 * Minimal path routing helper for Edge Functions.
 * Extracts the sub-path after the function name and matches route patterns.
 */

/**
 * Extract the sub-path after the function name segment.
 *
 * Supabase invokes Edge Functions at `/functions/v1/<functionName>/...`.
 * We look for the FIRST occurrence of `/<functionName>` followed by a path
 * boundary (`/` or end-of-string). The previous implementation used
 * `lastIndexOf` which had two failure modes:
 *
 *   1. A path containing the function name twice (e.g. /admin/admin/zones)
 *      would be parsed as /zones, bypassing the intended prefix and
 *      potentially matching unintended routes.
 *   2. A segment that merely STARTS with the function name (e.g.
 *      /admin-test/zones) would also match because the marker check did
 *      not enforce a path boundary after the function name.
 *
 * Both cases are now rejected: we walk indexOf occurrences and only accept
 * one whose next character is `/` or undefined.
 */
export function routePath(url: URL, functionName: string): string {
  const p = url.pathname;
  const marker = `/${functionName}`;
  let idx = p.indexOf(marker);
  while (idx >= 0) {
    const after = p[idx + marker.length];
    if (after === undefined || after === '/') {
      return p.slice(idx + marker.length) || '/';
    }
    idx = p.indexOf(marker, idx + 1);
  }
  return p;
}

/**
 * Match a path pattern like "/resources/:id" against an actual path.
 * Returns the captured params or null if no match.
 *
 * decodeURIComponent throws URIError on malformed escape sequences (e.g.
 * `%E0%A4%A` truncated). A well-behaved client will never produce one,
 * but a fuzzer or curious user can crash an unguarded handler. We catch
 * the URIError and return null (route does not match) — the caller will
 * fall through to the 404 path.
 */
export function matchRoute(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const keys: string[] = [];
  const regexStr = pattern.replace(/:([^/]+)/g, (_: string, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  const match = path.match(new RegExp(`^${regexStr}$`));
  if (!match) return null;

  const params: Record<string, string> = {};
  try {
    keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1]);
    });
  } catch (err) {
    if (err instanceof URIError) return null;
    throw err;
  }
  return params;
}
