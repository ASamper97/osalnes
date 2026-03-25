---
name: security-scan
description: Scan a file or directory for security vulnerabilities. Checks OWASP Top 10, auth bypass, injection, data exposure.
argument-hint: [file path or directory, e.g. "packages/api/src/routes/admin.ts"]
disable-model-invocation: true
---

Security scan of "$ARGUMENTS".

## Checks

### Authentication & Authorization
- [ ] All admin endpoints have `authMiddleware` applied
- [ ] `requireRole()` on every write operation (POST/PUT/PATCH/DELETE)
- [ ] No fallback to permissive role (must reject if user not in `usuario` table)
- [ ] JWT verified server-side via `supabase.auth.getUser(token)`

### Input Validation
- [ ] All user inputs validated before DB operations
- [ ] Slug regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- [ ] Email regex validation
- [ ] URL must start with `http://` or `https://`
- [ ] Coordinates: lat [-90,90], lng [-180,180]
- [ ] File uploads: MIME type whitelist enforced

### Data Exposure
- [ ] DB error messages sanitized (no table/column names leaked)
- [ ] No `password_hash` in API responses
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- [ ] `.env` files not committed to git

### Injection
- [ ] All DB queries use Supabase SDK (parameterized)
- [ ] No raw SQL concatenation
- [ ] `JSON.parse` wrapped in try/catch
- [ ] No `dangerouslySetInnerHTML` with user data

### CORS
- [ ] Origins configured per environment
- [ ] Credentials not sent with wildcard origin

## Output
Table with: finding, severity (critical/high/medium/low), file:line, recommendation.
