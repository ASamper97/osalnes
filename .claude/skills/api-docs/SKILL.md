---
name: api-docs
description: Update the OpenAPI spec (docs/openapi.yaml) when API endpoints change. Keeps documentation in sync with code.
argument-hint: [endpoint to document, e.g. "POST /assistant" or "all" to regenerate]
disable-model-invocation: true
---

Update OpenAPI documentation for: "$ARGUMENTS"

## Process

1. Read `docs/openapi.yaml` to understand current state
2. Read the relevant route file:
   - Public: `packages/api/src/routes/public.ts` or `supabase/functions/api/index.ts`
   - Admin: `packages/api/src/routes/admin.ts` or `supabase/functions/admin/index.ts`
   - Assistant: `supabase/functions/assistant/index.ts`
3. For each endpoint, document:
   - Path, method, summary, description
   - Parameters (query, path)
   - Request body schema (for POST/PUT/PATCH)
   - Response schema with example
   - Authentication requirements
4. Follow OpenAPI 3.0.3 format matching existing spec style

## Servers
```yaml
servers:
  - url: https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api
    description: Production
  - url: http://localhost:3001/api/v1
    description: Development
```

If "$ARGUMENTS" is "all", regenerate the complete spec from all route files.
