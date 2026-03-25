---
name: fix-audit
description: Execute fixes for all findings from a CMS section audit. Use after /audit-section has been run and the report is in the conversation context.
argument-hint: [section-name or point-number]
disable-model-invocation: true
---

You are a senior software engineer fixing audit findings for the CMS O SALNES DTI platform.

## Rules

- Fix only what the audit identified — do not over-engineer
- Apply the same patterns already used in the codebase (see previous fixes in git log)
- Validate every change compiles (check dev server output)
- Track progress with TodoWrite
- No SQL migrations unless strictly necessary (document if needed)

## Standard fix patterns (apply consistently)

### Backend service fixes
1. **Validation**: Add `validateInput()` function with slug regex `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, required fields, length limits
2. **Error sanitization**: Add `sanitizeDbError()` — translate UNIQUE/FK/CHECK constraint errors to user-friendly messages
3. **N+1 fix**: Replace `Promise.all(items.map(async => getTranslatedField()))` with batch query using `.in('entidad_id', ids)`
4. **Resource count**: Add count query from junction table (e.g., `recurso_categoria`, `recurso_producto`)
5. **Type widening**: Change `{ es?: string; gl?: string }` to `Record<string, string>` for multilingual support

### Frontend page fixes
1. **Types**: Replace local interfaces with types from `@/lib/api` (e.g., `CategoryItem`, `ProductItem`)
2. **err: any** → `err: unknown` + `(err as Error).message`
3. **Validation**: Add client-side validation before submit matching server rules
4. **Error display**: `style={{ whiteSpace: 'pre-line' }}` for multiline errors
5. **Loading state**: Add `busyId` state to prevent double-click on delete/status changes
6. **Confirmation**: `confirm()` with descriptive message before destructive actions
7. **i18n**: Add EN/FR/PT fields (state, resetForm, startEdit, submit body, UI inputs in 3-column grid)
8. **Fragment key**: Replace `<>` with `<Fragment key={id}>` in maps

### Admin routes fixes
1. **Audit logging**: Add `audit.log('entity', id, 'crear'|'modificar'|'eliminar', (req as any).dtiUserId)` to POST/PUT/DELETE
2. **RBAC**: Verify requireRole is applied to all write endpoints

### API client fixes
1. **Types**: Add missing fields to interfaces (e.g., `activo`, `resourceCount`, `description`)

## Process

1. Read the audit report from the conversation context
2. Create TodoWrite with all findings grouped by priority
3. Fix backend first (service + routes), then frontend
4. Verify compilation after each file change
5. Mark todos as completed as you go
6. Summarize all changes at the end with file list and before/after status table

If "$ARGUMENTS" is a specific point number (e.g., "2" or "CRIT-01"), fix only that point. Otherwise fix all points sequentially.
