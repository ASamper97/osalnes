---
name: deploy-all
description: Full deployment pipeline — Edge Functions + verify production endpoints. Use after significant changes.
argument-hint: [optional: "edge-only" or "verify-only"]
disable-model-invocation: true
---

Deploy all components of DTI O Salnes to production.

## Pipeline

### Step 1 — Deploy Edge Functions
```bash
npx supabase functions deploy api --no-verify-jwt --import-map supabase/functions/deno.json
npx supabase functions deploy admin --no-verify-jwt --import-map supabase/functions/deno.json
npx supabase functions deploy assistant --no-verify-jwt --import-map supabase/functions/deno.json
```

### Step 2 — Verify production endpoints
```bash
# Health
curl -s https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api/health

# Resources
curl -s "https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api/resources?limit=1"

# Map
curl -s "https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api/map/resources?bounds=42.3,-8.9,42.6,-8.6"

# JSON-LD
curl -s "https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api/export/jsonld" | head -1

# Assistant
curl -s -X POST "https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/assistant" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola","lang":"es"}'
```

### Step 3 — Git push (triggers Cloudflare auto-deploy)
```bash
git push origin main
```

Web and CMS deploy automatically on Cloudflare Pages when pushing to main.

## Troubleshooting
- **"Cannot find project ref"**: `npx supabase link --project-ref oduglbxjcmmdexwplzvw`
- **"not logged in"**: `npx supabase login`
- **Import errors**: Check `supabase/functions/deno.json`
- **FK errors**: Check if migration has been executed in SQL Editor

## If "$ARGUMENTS" is "edge-only": skip Step 3
## If "$ARGUMENTS" is "verify-only": skip Step 1, only run Step 2
