---
name: lighthouse-audit
description: Run Lighthouse accessibility audit on a page and analyze results. Requires dev server running.
argument-hint: [URL path, e.g. "/es" or "/es/mapa" or "all"]
disable-model-invocation: true
---

Run Lighthouse accessibility audit on "$ARGUMENTS".

## Process

1. Verify dev server is running (`curl http://localhost:3000`)
2. If "$ARGUMENTS" is "all", audit these pages:
   - http://localhost:3000/es
   - http://localhost:3000/es/buscar
   - http://localhost:3000/es/mapa
   - http://localhost:3000/es/recurso/parador-de-cambados
   Otherwise audit: http://localhost:3000$ARGUMENTS

3. Run Lighthouse:
```bash
lighthouse http://localhost:3000{path} \
  --only-categories=accessibility \
  --output=json \
  --output-path=./docs/evidencias/lighthouse_{name}.json \
  --chrome-flags="--headless --no-sandbox" \
  --quiet
```

4. Parse results:
   - Extract overall score
   - List all failures with impact serious/critical
   - For each failure: selector, explanation, contrast ratio

5. If score < 100, identify the fix and apply it
6. Re-run Lighthouse to verify fix

## Output format
```
Page: /es
Score: 100/100
Failures: 0

Page: /es/mapa
Score: 84/100
Failures: 3 (all false positives from Next.js dev overlay)
```

Target: >= 95/100 on all pages (100 excluding dev-only false positives).
