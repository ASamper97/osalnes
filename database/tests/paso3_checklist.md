# Checklist E2E · Paso 3 del wizard (rediseño ubicación y contacto)

Estado tras aplicar las 5 tareas del prompt `04_paso3_location.md` sobre
el código del repo. Los 13 puntos del `ResourceWizardPage.step3.integration.md`
se evalúan aquí.

> ⚙ = verificado estáticamente en el código (no requiere browser).
> 👁 = requiere smoke test manual en el CMS desplegado tras los deploys
>       de admin y api (ver "Acciones pendientes" abajo).

| # | Punto | Estado |
|---|---|---|
| 1 | `leaflet@1.9.4` + `react-leaflet@4.2.1` + `@types/leaflet` instaladas, `leaflet/dist/leaflet.css` importado en `main.tsx` | ⚙ (confirmado — `packages/cms/package.json` + `packages/cms/src/main.tsx:3`) |
| 2 | Migración 021 aplicada. 9 columnas nuevas + vista + 3 índices. | ⚙ (verificado en Supabase 2026-04-20: columnas=9, vista OK, idx social_links OK, idx opening_hours_kind OK, default `'[]'::jsonb`) |
| 3 | Crear recurso "Playa" → paso 3 el mapa se centra en el municipio del paso 1. | 👁 |
| 4 | Tab "Buscar dirección": buscar "Praza de Fefiñáns Cambados" → resultado → clic → pin + auto-rellena dirección postal. | 👁 |
| 5 | Tab "Clicar en el mapa": clic → pin aparece, coordenadas se muestran debajo. | 👁 |
| 6 | Tab "Pegar enlace": `https://www.google.com/maps/@42.5,-8.8,15z` + "Extraer" → pin. | 👁 |
| 7 | Arrastrar pin → coordenadas y dirección se actualizan (reverse geocoding). | 👁 |
| 8 | Pin fuera de O Salnés (ej. Madrid) → warning amarillo no bloqueante. | 👁 |
| 9 | Contacto: teléfono, email, web, Instagram → guardar + recargar → persiste. | 👁 |
| 10 | Horarios — las 7 plantillas (always / weekly / seasonal / appointment / event / external / closed) + copy L-V 9-14 a días laborables + cierres `closures[]`. | 👁 |
| 11 | Accesibilidad con teclado: Tab entre campos, zoom con `+`/`-`, pan con flechas cuando foco en el mapa. | 👁 |
| 12 | Mobile (viewport <900px): layout en una columna. | 👁 |
| 13 | Acentos correctos (Ubicación, Dirección, Teléfono, Inglés, etc.) | ⚙ (todo el copy del paso 3 vive en `step3-location.copy.ts`; no hay literales hardcoded en el componente principal) |

## Acciones pendientes para smoke test

El checklist funcional requiere que **admin y api** estén desplegadas con
los 9 campos nuevos reconocidos. Tras el push del bloque paso 3:

```bash
cd "c:/Users/sampe/Downloads/O SALNÉS/osalnes-dti"
npx supabase functions deploy admin
npx supabase functions deploy api
```

Sin esos deploys, el CMS carga y permite editar el paso 3 pero al
guardar los 9 campos nuevos se descartan silenciosamente (admin
whitelist) y al recargar el recurso los datos del paso 3 vuelven a
estar vacíos.

## Deuda abierta

- **Nominatim rate limit 1 req/s**: para crear recursos uno a uno
  sobra, pero el import masivo del xlsx (1151 recursos) tendrá que
  cachear o usar endpoint propio de geocoding (ver prompt paso 3 §
  riesgos).
- **Enlaces acortados de Google Maps** (maps.app.goo.gl): no se
  resuelven por CORS. El usuario debe usar el enlace completo
  `/maps/@lat,lng,zoom`.
- **Mapper PID de horarios**: las variantes `appointment`, `external`
  y `closed` se publican como nota textual porque schema.org no tiene
  subtipo directo. Si se quiere mejor granularidad, hay que definir
  una extensión propia.
- **Toolbar subset de RichTextEditor**: arrastrada del paso 2, sigue
  sin implementar (la prop se acepta pero no filtra botones).
