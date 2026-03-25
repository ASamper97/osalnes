---
name: wcag-check
description: Quick WCAG 2.1 AA accessibility check on a component or page. Checks contrast, ARIA, keyboard, headings.
argument-hint: [file path, e.g. "packages/web/src/components/MapView.tsx"]
disable-model-invocation: true
---

WCAG 2.1 AA check on "$ARGUMENTS".

## Quick checks

### Perceivable
- [ ] Images have `alt` text (or `alt=""` if decorative)
- [ ] Color contrast >= 4.5:1 for normal text, >= 3:1 for large text (18px+)
- [ ] No info conveyed by color alone

### Operable
- [ ] All interactive elements focusable via keyboard (Tab)
- [ ] Focus visible: `:focus-visible` with `outline` (not just `:focus`)
- [ ] No keyboard traps
- [ ] Touch targets >= 44x44px on mobile (`@media (pointer: coarse)`)

### Understandable
- [ ] Form inputs have `<label htmlFor>` or `aria-label`
- [ ] Error messages visible and descriptive
- [ ] Headings follow hierarchy (h1 > h2 > h3, no skipping)

### Robust
- [ ] `aria-label` on buttons with only icons
- [ ] `aria-expanded` on toggles (mobile menu, drawers)
- [ ] `aria-hidden="true"` on decorative SVGs
- [ ] `role` attributes where needed (region, search, dialog, log)
- [ ] External links: `aria-label` mentioning "new window"

## CSS variables to check (project specific)
- `--color-text` (#2c3e50) / white = 7.9:1 OK
- `--color-muted` (#545e64) / white = 5.6:1 OK
- `--color-muted` (#545e64) / bg-alt (#f8f9fa) = 5.1:1 OK
- `--color-secondary` (#2471a3) / bg-alt = 4.83:1 OK

Output: pass/fail per check with file:line references.
