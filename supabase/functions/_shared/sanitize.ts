/**
 * HTML sanitizer for user-supplied content (audit S7).
 *
 * Why
 * ---
 * Description fields in the CMS use a RichTextEditor (Tiptap) and produce
 * HTML that is later rendered on the public web with `dangerouslySetInnerHTML`.
 * Tiptap normally restricts the toolbar, but raw HTML pasted from the
 * clipboard, or a malicious editor with the `editor` role, can inject
 * `<script>`, `<iframe>`, event handlers (`onclick`, `onload`...) or
 * `javascript:` URIs. None of these are blocked by Tiptap on the way out.
 *
 * Defending at the public-web render layer is fragile (every consumer must
 * remember to sanitize). Instead, we sanitize ONCE at the persistence
 * boundary: every value going into `traduccion` goes through `sanitizeHtml`
 * before the upsert. The DB never stores hostile markup, so every consumer
 * is automatically safe.
 *
 * Approach
 * --------
 * Pure regex sanitizer (no DOM parser, no external dep). Strict allowlist
 * of tags + a denyset for dangerous attributes and URI schemes. Not as
 * thorough as DOMPurify, but Deno doesn't ship a full DOM and the regex
 * approach handles the realistic threat model (a logged-in editor pasting
 * malicious markup) without bringing in 200kB of dependencies.
 *
 * If/when we move to a proper sanitizer, this file is the single seam to
 * replace.
 */

// Tags allowed inside descriptions / SEO blurbs / page bodies. Anything not
// in this list is stripped (the contents are kept, only the wrapper tags go).
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre',
  'a',
  'span', 'div',
]);

// Attributes allowed PER TAG. Anything not listed is stripped.
const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target']),
  // span/div get class for styling but nothing else
  span: new Set(['class']),
  div: new Set(['class']),
};

// URL schemes allowed in href / src. javascript:, data:, vbscript:, file: are
// blocked. Relative URLs (no scheme) and # anchors are allowed.
const SAFE_URL_RE = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i;

/**
 * Sanitize a string of HTML. Returns a string safe to render with
 * dangerouslySetInnerHTML.
 *
 * Algorithm:
 *   1. Strip every script/style/iframe/object/embed/form/input/meta/link
 *      block (tag + content) — these have NO legitimate use in a description.
 *   2. Walk every remaining tag and either keep it (with allowed attrs only)
 *      or replace it with empty string while keeping its inner text.
 *   3. Strip any attribute that starts with `on` (onload, onerror, ...).
 *   4. For href/src attrs, drop the attribute if the URL scheme is unsafe.
 *   5. Replace HTML comments — they can contain conditional IE blocks.
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let html = input;

  // 1. Strip dangerous block tags AND their content (greedy match).
  //    Order matters: do this BEFORE the generic tag walker so the inner
  //    text of <script> doesn't end up as plain text in the output.
  html = html.replace(/<(script|style|iframe|object|embed|form|input|meta|link|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Also strip self-closing variants
  html = html.replace(/<(script|style|iframe|object|embed|form|input|meta|link|svg)\b[^>]*\/?>/gi, '');

  // 2. Strip HTML comments (no use case in user content)
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // 3. Walk every tag. Keep allowed ones (with sanitized attrs), drop the
  //    rest while preserving the inner text.
  html = html.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (_match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();

    // Closing tag → keep only if the tag is in the allowlist
    if (_match.startsWith('</')) {
      return ALLOWED_TAGS.has(tag) ? `</${tag}>` : '';
    }

    // Opening tag — drop entirely if not allowed (inner text stays because
    // we don't strip it, only the surrounding tag is removed)
    if (!ALLOWED_TAGS.has(tag)) return '';

    // Sanitize attributes
    const allowedAttrs = ALLOWED_ATTRS_BY_TAG[tag] || new Set<string>();
    const cleanAttrs: string[] = [];

    // Match name=value or name="value" or name='value' or just name
    const attrRe = /([a-z_:][\w:.-]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrs)) !== null) {
      const name = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? m[5] ?? '';

      // Strip every event handler (onload, onclick, onerror, …)
      if (name.startsWith('on')) continue;

      // Strip every attribute not in the per-tag allowlist
      if (!allowedAttrs.has(name)) continue;

      // For URL-like attrs, validate the scheme
      if (name === 'href' || name === 'src') {
        if (value && !SAFE_URL_RE.test(value)) continue;
      }

      // Strip the value of any javascript:/data:/vbscript: even if attr is allowed
      if (/javascript:|vbscript:|data:text\/html/i.test(value)) continue;

      // Force target=_blank links to add rel=noopener noreferrer (open redirect / tabnabbing)
      cleanAttrs.push(value ? `${name}="${escapeAttr(value)}"` : name);
    }

    // For <a target="_blank">, force rel=noopener noreferrer
    if (tag === 'a' && /target\s*=\s*["']?_blank/i.test(attrs)) {
      const hasRel = cleanAttrs.some((a) => a.startsWith('rel='));
      if (!hasRel) cleanAttrs.push('rel="noopener noreferrer"');
    }

    return cleanAttrs.length > 0 ? `<${tag} ${cleanAttrs.join(' ')}>` : `<${tag}>`;
  });

  return html;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Plain-text sanitizer: strips ALL HTML and returns just the text content.
 * Used for fields that must never be HTML (name, slug, SEO title...).
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return input;
  return input
    .replace(/<[^>]*>/g, '')   // strip every tag
    .replace(/&lt;/g, '<')      // un-escape common entities
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
