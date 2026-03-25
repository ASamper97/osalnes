---
name: deploy-edge
description: Deploy Supabase Edge Functions (api and admin) to production. Use when asked to deploy, push to production, or update edge functions.
argument-hint: [api|admin|all]
disable-model-invocation: true
---

Deploy Supabase Edge Functions for the O SALNES DTI platform.

## Prerequisites check

Before deploying, verify:
1. Supabase CLI is available: `npx supabase --version`
2. User is logged in: `npx supabase projects list`
3. Project is linked: check `supabase/.temp/project-ref` or run `npx supabase link --project-ref oduglbxjcmmdexwplzvw`

## Deploy process

The project has 2 Edge Functions:
- **api** — Public read-only endpoints (resources, map, search, etc.)
- **admin** — Authenticated CRUD endpoints (requires JWT)

Both require `--no-verify-jwt` (manual JWT verification in code) and `--import-map supabase/functions/deno.json`.

### If "$ARGUMENTS" is "api" or empty:
```bash
npx supabase functions deploy api --no-verify-jwt --import-map supabase/functions/deno.json
```

### If "$ARGUMENTS" is "admin":
```bash
npx supabase functions deploy admin --no-verify-jwt --import-map supabase/functions/deno.json
```

### If "$ARGUMENTS" is "all" or not specified:
Deploy both sequentially:
```bash
npx supabase functions deploy api --no-verify-jwt --import-map supabase/functions/deno.json
npx supabase functions deploy admin --no-verify-jwt --import-map supabase/functions/deno.json
```

## Post-deploy verification

After each deploy:
1. Confirm output says "Deployed Functions on project oduglbxjcmmdexwplzvw"
2. Report the dashboard URL: `https://supabase.com/dashboard/project/oduglbxjcmmdexwplzvw/functions`

## Troubleshooting

- **"Cannot find project ref"**: Run `npx supabase link --project-ref oduglbxjcmmdexwplzvw`
- **"not logged in"**: Run `npx supabase login` (opens browser)
- **Import errors**: Verify `supabase/functions/deno.json` has the `@supabase/supabase-js` import map
- **config.toml errors**: Ensure `[functions.api]` and `[functions.admin]` sections exist with `verify_jwt = false`
