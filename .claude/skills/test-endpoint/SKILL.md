---
name: test-endpoint
description: Test an API endpoint with curl and verify the response. Use to validate endpoints work correctly.
argument-hint: [GET/POST method + path, e.g. "GET /resources" or "POST /admin/resources"]
disable-model-invocation: true
---

Test the API endpoint "$ARGUMENTS" against the local dev server.

## Process

1. Parse the method and path from "$ARGUMENTS"
2. Determine if it's a public or admin endpoint:
   - Public: `http://localhost:3001/api/v1/{path}`
   - Admin: `http://localhost:3001/api/v1/admin/{path}` (needs auth)
3. For admin endpoints, get a valid JWT token from Supabase
4. Execute curl with appropriate headers
5. Validate response:
   - Status code is correct (200, 201, 400, etc.)
   - Response is valid JSON
   - Response shape matches expected schema
   - No internal error messages exposed
6. Also test against production Edge Function if available:
   - Public: `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api/{path}`

## Output format
```
Endpoint: METHOD /path
Local: HTTP {status} ({duration}ms)
Response: {first 200 chars}
Validation: PASS/FAIL + details
```
