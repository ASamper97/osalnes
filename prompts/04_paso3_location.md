# Prompt maestro · Rediseño Paso 3 "Ubicación y contacto"

**Pega este contenido en Claude Code.**

Ejecuta el rediseño completo del paso 3 del wizard de recursos. Este
prompt se ejecuta **después** del paso 2 y **antes** de los pasos 4–7.

---

## Contexto del cambio

El paso 3 actual ("Ubicación + Contacto") tiene tres problemas críticos:

1. **Coordenadas manuales** — el usuario debe pegar lat/lng en dos
   inputs separados tras buscar en Google Maps. Resultado: invierten
   coordenadas, copian comas en vez de puntos, o ni lo hacen.
2. **Horarios como textarea libre** — el texto escrito a mano no se
   puede exportar al PID (UNE 178503 exige `OpeningHoursSpecification`
   estructurado) y no aparece filtrado en la web pública.
3. **Bloque "Ubicación + Contacto" mezcla dos responsabilidades** sin
   jerarquía visual clara.

El pliego (apartado 5.4) exige explícitamente que el CMS permita
**edición y corrección de coordenadas desde el entorno de
administración** — es decir, un mapa editable, no inputs de texto.

## Solución

- **Mapa interactivo Leaflet + OpenStreetMap** (gratis, sin API key)
  con pin arrastrable y clic para colocar.
- **3 métodos de ubicación** en tabs: buscar dirección (Nominatim),
  clicar en el mapa, pegar enlace de Google Maps/OSM.
- **Geocoding reverso automático**: al mover el pin se rellena calle,
  CP, municipio y parroquia.
- **Horarios estructurados** con 7 plantillas (24/7, semanal, temporada,
  cita previa, evento, sin horario, cerrado temporal) más cierres
  puntuales ortogonales.
- **Redes sociales** como array tipado de 7 plataformas (Instagram,
  Facebook, TikTok, YouTube, X, LinkedIn, WhatsApp).
- **Sin IA en este paso** — decisión de producto. Mantiene simplicidad.

## Ficheros ya escritos y colocados en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 021_location_contact_hours.sql         ← columnas + JSONB + índices
│   └── 021_location_contact_hours.down.sql
│
├── packages/shared/src/data/
│   ├── opening-hours.ts                       ← modelo de las 7 plantillas
│   └── osalnes-geo.ts                         ← centros de 9 municipios + bbox
│
└── packages/cms/src/
    ├── lib/
    │   └── geocoding.ts                       ← cliente Nominatim
    ├── components/
    │   ├── LocationMap.tsx                    ← wrapper Leaflet
    │   ├── OpeningHoursSelector.tsx           ← editor 7 plantillas
    │   └── SocialLinksEditor.tsx              ← 7 plataformas sociales
    └── pages/
        ├── ResourceWizardStep3Location.tsx    ← componente principal
        ├── step3-location.copy.ts             ← copy centralizado
        ├── step3-location.css
        └── ResourceWizardPage.step3.integration.md  (doc)
```

---

## Tareas en orden

### Tarea 1 · Instalar dependencias y CSS de Leaflet

```bash
pnpm --filter @osalnes/cms add leaflet@1.9.4 react-leaflet@4.2.1
pnpm --filter @osalnes/cms add -D @types/leaflet
```

**IMPORTANTE — react-leaflet 5.x exige React 19.** Como el proyecto
usa React 18, fijar a `4.2.1`. Si más adelante se migra a React 19 se
puede subir, la API es compatible.

En el entry point del CMS (`main.tsx` o `App.tsx`), añadir **antes** de
los imports de estilos propios:

```ts
import 'leaflet/dist/leaflet.css';
```

Sin este CSS, los tiles del mapa se rompen y los controles de zoom no
tienen estilo.

**Criterio**: arrancar `pnpm --filter @osalnes/cms dev`, sin errores en
consola ni warnings nuevos de React.

### Tarea 2 · Aplicar migración 021

```bash
npx supabase db push
```

Verificar:

```sql
\d public.resources
-- Deben aparecer: street_address, postal_code, locality, parroquia_text,
-- contact_phone, contact_email, contact_web, social_links (jsonb),
-- opening_hours_plan (jsonb)

select * from public.v_resources_geolocated limit 1;
-- La vista debe existir (puede estar vacía si no hay recursos con lat/lng)
```

La migración es idempotente (`do $$ ... $$` con `if not exists`), así
que correrla dos veces no rompe nada.

### Tarea 3 · Verificar que los componentes nuevos typechequean

Los componentes nuevos importan:

- `@osalnes/shared/data/opening-hours` (nuevo en esta tarea)
- `@osalnes/shared/data/osalnes-geo` (nuevo en esta tarea)
- `./HelpBlock` (existe desde el paso 2)
- `react-leaflet`, `leaflet` (instalados en la tarea 1)

Verificar:

```bash
pnpm --filter @osalnes/shared typecheck
pnpm --filter @osalnes/cms typecheck
```

Sin errores nuevos. Los errores pre-existentes en otros ficheros no
tocados (si los hay) se ignoran por ahora.

### Tarea 4 · Integrar paso 3 en `ResourceWizardPage.tsx`

Sigue la guía completa en:
`packages/cms/src/pages/ResourceWizardPage.step3.integration.md`

Resumen:

1. **Imports** nuevos (sección 3 del integration.md).
2. **Estado nuevo**: `location`, `contact`, `hoursPlan` con hidratación
   desde `initialResource` (secciones 4-5).
3. **Render**: reemplazar el bloque monolítico actual del paso 3 por
   `<ResourceWizardStep3Location>` (sección 5).
4. **Validación** al pulsar "Siguiente" (sección 6).
5. **Guardado** en BD con los campos nuevos (sección 7).
6. **Borrar los campos legacy** del paso 3 actual (sección 8). NO
   borrar las columnas legacy de BD — eso es una migración aparte.

### Tarea 5 · Exportación a PID

Localiza el exportador PID (probablemente en `supabase/functions/` o
en `packages/cms/src/lib/pid/`). Añadir el mapeo documentado en la
sección 9 del integration.md:

- Dirección: `hasLocation.lat/long/streetAddress/postalCode/addressLocality`
- Contacto: `hasContactPoint.telephone/email/url`
- `sameAs[]` desde `social_links`
- `hasOpeningHours` + `specialOpeningHoursSpecification[]` desde
  `opening_hours_plan`

**No bloqueante** para este paso: si la función de export todavía no
mapea los nuevos campos, el CMS sigue funcionando. Se puede hacer en
una tarea aparte.

### Tarea 6 · Test E2E del flujo completo

Ejecutar el checklist de aceptación del final del `integration.md` (13
puntos). Prestar atención especial a:

- El mapa se centra correctamente cuando el paso 1 tiene municipio.
- El geocoding search devuelve resultados dentro de 1-2 segundos
  (Nominatim es gratis pero tiene rate limit de 1 req/s).
- El geocoding reverso funciona al mover el pin.
- El warning "fuera de O Salnés" aparece cuando corresponde y no
  cuando no.
- Los horarios se guardan como JSONB con la shape correcta.
- Accesibilidad con teclado en el mapa funciona.

---

## Lo que NO tocar

- Pasos 1, 2, 4, 5, 6, 7 — cada uno tiene su propio prompt.
- Columnas legacy de contacto y horarios en `resources` — la limpieza
  física va en una migración posterior.
- El exportador PID (opcional, ver tarea 5).
- El motor del wizard (`Wizard.tsx`) — no cambia.

## Riesgos conocidos

1. **Nominatim rate limit**: 1 req/s por IP. Para creación manual de
   <5 recursos/mes sobra, pero si se hace un import masivo hay que
   cachear o migrar a un endpoint propio.
2. **Enlaces acortados de Google Maps** (maps.app.goo.gl): no
   soportados porque requieren resolver redirect y CORS lo bloquea
   desde el navegador. El usuario debe usar el enlace completo.
3. **React 19**: si el proyecto sube a React 19 en el futuro, subir
   `react-leaflet` a 5.x (sin cambios en nuestro código).

## Mensajes de commit sugeridos

```
feat(shared): modelo de datos opening-hours y geo O Salnés (paso 3 · t1)
feat(db): migración 021 ubicación/contacto/horarios estructurados (paso 3 · t2)
feat(cms): LocationMap, geocoding Nominatim, selector de horarios (paso 3 · t3)
feat(cms): rediseño paso 3 con mapa interactivo (paso 3 · t4)
chore(pid): mapeo de horarios estructurados al export (paso 3 · t5, opcional)
```
