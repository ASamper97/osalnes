---
name: code-review
description: Review code changes for bugs, security, performance, and best practices. Use before committing or when reviewing a specific file.
argument-hint: [file-path or "staged" for git staged changes]
disable-model-invocation: true
---

Review code in "$ARGUMENTS" for the O Salnes DTI platform.

## Checklist

### Security
- [ ] No `err: any` — use `err: unknown`
- [ ] No DB error messages exposed to client (use `sanitizeDbError`)
- [ ] RBAC `requireRole()` on all write endpoints
- [ ] No hardcoded secrets or API keys
- [ ] Input validation on both client and server
- [ ] MIME type validation on file uploads

### Performance
- [ ] No N+1 queries (use batch `IN()` for translations)
- [ ] `Promise.all` for independent parallel queries
- [ ] `useCallback`/`useMemo` where appropriate in React

### TypeScript
- [ ] No `any` types — use interfaces from `packages/cms/src/lib/api.ts`
- [ ] Proper error typing: `catch (err: unknown) { (err as Error).message }`

### UX (CMS)
- [ ] Loading states on async operations (`saving`, `busyId`)
- [ ] `confirm()` before destructive actions
- [ ] Error display with `whiteSpace: pre-line` for multiline

### WCAG (Web)
- [ ] `aria-label` on interactive elements without visible text
- [ ] `:focus-visible` not `:focus` for keyboard styles
- [ ] Contrast ratios >= 4.5:1
- [ ] `<label>` for all form inputs

### UNE 178503
- [ ] Translations support 5 languages (ES, GL, EN, FR, PT)
- [ ] `audit.log()` on CRUD operations

If "$ARGUMENTS" is "staged", run `git diff --cached` to get the changes.
Output: list of issues found with file:line references and severity (critical/medium/low).
