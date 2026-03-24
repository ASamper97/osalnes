/**
 * Minimal path routing helper for Edge Functions.
 * Extracts the sub-path after the function name and matches route patterns.
 */

/** Extract the sub-path after the function name segment. */
export function routePath(url: URL, functionName: string): string {
  const p = url.pathname;
  const marker = `/${functionName}`;
  const idx = p.lastIndexOf(marker);
  if (idx >= 0) {
    return p.slice(idx + marker.length) || '/';
  }
  return p;
}

/**
 * Match a path pattern like "/resources/:id" against an actual path.
 * Returns the captured params or null if no match.
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
  keys.forEach((key, i) => {
    params[key] = decodeURIComponent(match[i + 1]);
  });
  return params;
}
