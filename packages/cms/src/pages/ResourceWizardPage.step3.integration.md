# Integración · Paso 3 en `ResourceWizardPage.tsx`

Cambios concretos para cablear el rediseño del paso 3 en el
`ResourceWizardPage.tsx` real. Este documento es documentación, **no
código compilable**.

---

## 1) Instalar dependencias nuevas

El rediseño usa **Leaflet + react-leaflet** (gratis, sin API key). En
`packages/cms`:

```bash
pnpm --filter @osalnes/cms add leaflet@1.9.4 react-leaflet@4.2.1
pnpm --filter @osalnes/cms add -D @types/leaflet
```

> ⚠️ IMPORTANTE: `react-leaflet@5` exige React 19. Como el proyecto usa
> React 18 todavía, **fijar la versión a 4.2.1**. Si más adelante se
> sube a React 19, se puede migrar a 5.x sin cambios en los
> componentes.

En el **entry point del CMS** (probablemente `packages/cms/src/main.tsx`
o `App.tsx`), añadir el import del CSS global de Leaflet **antes** de
cualquier import de estilos propios:

```ts
import 'leaflet/dist/leaflet.css';
```

Si no se carga este CSS, los tiles del mapa aparecen rotos y los
controles de zoom salen sin estilo.

## 2) Aplicar migración 021

```bash
# desde la raíz del repo, con supabase CLI autenticado
npx supabase db push
```

Ver `database/migrations/021_location_contact_hours.sql`. Idempotente:
se puede correr varias veces sin efectos laterales.

**Test post-migración**:
```sql
-- Verificar que las columnas existen
\d public.resources
-- Deben aparecer: street_address, postal_code, locality, parroquia_text,
-- contact_phone, contact_email, contact_web, social_links (jsonb),
-- opening_hours_plan (jsonb)

-- Verificar vista
select * from public.v_resources_geolocated limit 1;
```

## 3) Imports nuevos en `ResourceWizardPage.tsx`

```tsx
import ResourceWizardStep3Location from './ResourceWizardStep3Location';
import type {
  LocationData,
  ContactData,
} from './ResourceWizardStep3Location';
import type { SocialLink } from '../components/SocialLinksEditor';
import type { OpeningHoursPlan } from '@osalnes/shared/data/opening-hours';
import { emptyPlanByKind, validatePlan } from '@osalnes/shared/data/opening-hours';
import './step3-location.css';
```

## 4) Estado nuevo que el paso 3 consume

En el cuerpo del `ResourceWizardPage`:

```tsx
// Ubicación (reemplaza a [lat, setLat] y [lng, setLng] sueltos si existían)
const [location, setLocation] = useState<LocationData>({
  lat: null,
  lng: null,
  streetAddress: '',
  postalCode: '',
  locality: '',
  parroquia: '',
});

// Contacto (reemplaza a [phone, email, web, socialFb, socialIg...] sueltos)
const [contact, setContact] = useState<ContactData>({
  phone: '',
  email: '',
  web: '',
  socialLinks: [],
});

// Horarios (reemplaza al textarea libre de horarios anterior)
const [hoursPlan, setHoursPlan] = useState<OpeningHoursPlan>(
  emptyPlanByKind('weekly'),
);
```

**Hidratación desde BD** al cargar un recurso existente:

```tsx
useEffect(() => {
  if (!initialResource) return;

  setLocation({
    lat: initialResource.latitude ?? null,
    lng: initialResource.longitude ?? null,
    streetAddress: initialResource.street_address ?? '',
    postalCode: initialResource.postal_code ?? '',
    locality: initialResource.locality ?? '',
    parroquia: initialResource.parroquia_text ?? '',
  });

  setContact({
    phone: initialResource.contact_phone ?? '',
    email: initialResource.contact_email ?? '',
    web: initialResource.contact_web ?? '',
    socialLinks: (initialResource.social_links as SocialLink[]) ?? [],
  });

  if (initialResource.opening_hours_plan) {
    setHoursPlan(initialResource.opening_hours_plan as OpeningHoursPlan);
  } else {
    setHoursPlan(emptyPlanByKind('weekly'));
  }
}, [initialResource]);
```

## 5) Render del paso 3

Donde antes estaba el bloque monolítico de ubicación + contacto (con
los inputs manuales de lat/lng, los 7 campos de contacto y el textarea
de horarios), ahora:

```tsx
<ResourceWizardStep3Location
  location={location}
  onChangeLocation={setLocation}
  contact={contact}
  onChangeContact={setContact}
  hoursPlan={hoursPlan}
  onChangeHoursPlan={setHoursPlan}
  municipioName={selectedMunicipioName}  // del paso 1
/>
```

## 6) Validación al pulsar "Siguiente"

```tsx
function validateStep3(): string[] {
  const errors: string[] = [];

  // Coordenadas: si el usuario puso una, que ambas estén puestas
  if ((location.lat != null) !== (location.lng != null)) {
    errors.push('Las coordenadas deben tener latitud y longitud.');
  }

  // Email
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.push('El correo electrónico no tiene un formato válido.');
  }

  // Web
  if (contact.web && !/^https?:\/\//.test(contact.web)) {
    errors.push('El sitio web debe empezar por http:// o https://');
  }

  // Plan de horarios
  errors.push(...validatePlan(hoursPlan));

  return errors;
}
```

Interceptar el botón "Siguiente" del paso 3 para mostrar los errores
antes de avanzar. Si no hay, avanzar normalmente. Las coordenadas NO
son obligatorias (se puede publicar un recurso sin mapa) pero **sí**
damos feedback en el paso 7 ("Revisión") de que está incompleto.

## 7) Guardado en BD

Cuando el wizard llama a `supabase.from('resources').upsert(...)`,
añadir al payload:

```tsx
const payload = {
  ...existingFields,

  // Ubicación
  latitude: location.lat,
  longitude: location.lng,
  street_address: location.streetAddress || null,
  postal_code: location.postalCode || null,
  locality: location.locality || null,
  parroquia_text: location.parroquia || null,

  // Contacto
  contact_phone: contact.phone || null,
  contact_email: contact.email || null,
  contact_web: contact.web || null,
  social_links: contact.socialLinks,  // JSONB array, no null

  // Horarios
  opening_hours_plan: hoursPlan,       // JSONB object
};
```

## 8) Borrar los campos legacy del paso 3

Hay que localizar y borrar (o marcar como deprecated) los siguientes
bloques del `ResourceWizardPage.tsx`:

- El bloque "Ubicación" con inputs manuales de lat/lng y el enlace a
  Google Maps como "tip".
- Los 5 campos de contacto sueltos (teléfonos, email, web, redes
  sociales con inputs por plataforma).
- El textarea libre de horarios (y el campo "notas de horario" si
  existe).

**NO borrar** las columnas de BD legacy (`opening_hours_text` si
existe, o similar). La limpieza física va en una migración posterior
cuando todos los recursos estén migrados.

## 9) Exportación a PID

El mapeo a UNE 178503 / schema.org queda así:

| Campo interno | Campo PID / schema.org |
|---|---|
| `location.lat` | `hasLocation.lat` / `latitude` |
| `location.lng` | `hasLocation.long` / `longitude` |
| `location.streetAddress` | `hasLocation.streetAddress` |
| `location.postalCode` | `hasLocation.postalCode` |
| `location.locality` | `hasLocation.municipality` / `addressLocality` |
| `location.parroquia` | `hasLocation.county` o campo ampliado |
| (derivado) `addressRegion` | siempre "Galicia" |
| (derivado) `addressProvince` | siempre "Pontevedra" |
| (derivado) `addressCountry` | siempre "ES" |
| `contact.phone` | `hasContactPoint.telephone` |
| `contact.email` | `hasContactPoint.email` |
| `contact.web` | `hasContactPoint.url` |
| `contact.socialLinks[].url` | `sameAs[]` |
| `hoursPlan` (7 variantes) | `hasOpeningHours` (ver tabla abajo) |
| `hoursPlan.closures` | `specialOpeningHoursSpecification[]` |

**Mapeo de cada plantilla a `OpeningHoursSpecification`** (pendiente
para una función `planToPidPayload()` que se implementará en el
exportador PID, no en este paso):

- `always` → `open24Hours: true`
- `weekly` → array de `{ dayOfWeek, opensAt, closesAt }` por cada tramo
- `seasonal` → array con `validFrom/validTo` por periodo
- `appointment` → nota textual + `telephone` referenciado
- `event` → `validFrom/validTo` con `startDate/endDate`
- `external` → nota con URL
- `closed` → `temporaryClosure: true` + fechas

## 10) Checklist de aceptación

- [ ] Instalada `leaflet@1.9.4 react-leaflet@4.2.1` y añadido el
      import `leaflet/dist/leaflet.css` en el entry point.
- [ ] Aplicada migración 021. `\d public.resources` muestra las nuevas
      columnas.
- [ ] Crear recurso nuevo tipo "Playa": al llegar al paso 3, el mapa se
      centra automáticamente en el municipio del paso 1.
- [ ] Tab "Buscar dirección": escribir "Praza de Fefiñáns Cambados",
      aparece resultado, clicar → pin se coloca y la dirección postal se
      auto-rellena.
- [ ] Tab "Clicar en el mapa": hacer clic en cualquier parte del mapa
      → pin aparece, coordenadas se actualizan en el texto debajo del
      mapa.
- [ ] Tab "Pegar enlace": pegar `https://www.google.com/maps/@42.5,-8.8,15z`,
      pulsar "Extraer" → pin aparece.
- [ ] Arrastrar el pin → coordenadas y dirección se actualizan.
- [ ] Poner el pin fuera de O Salnés (p.ej. en Madrid) → aparece
      warning amarillo no bloqueante.
- [ ] Contacto: rellenar teléfono, email, web. Añadir una red social
      (Instagram). Guardar y recargar → persiste.
- [ ] Horarios · plantilla "Siempre abierto": marcar y guardar →
      `opening_hours_plan` en BD es `{ "kind": "always" }`.
- [ ] Horarios · plantilla "Semanal fijo": marcar L-V 9-14 y 16-19,
      S-D cerrado. Pulsar "Copiar a días laborables" → L-V heredan los
      tramos. Guardar → `opening_hours_plan` en BD es un objeto
      `{ kind: 'weekly', days: [...] }` con los tramos.
- [ ] Horarios · plantilla "Temporada": añadir "Verano (jul-sep)" con
      su propio horario. Guardar → JSONB refleja el array `periods[]`.
- [ ] Horarios · plantilla "Evento": fechas y hora → se guardan.
- [ ] Horarios · plantilla "Cita previa" sin teléfono en contacto →
      aparece mensaje pidiendo que se rellene el teléfono. Rellenarlo →
      el mensaje cambia y muestra el número.
- [ ] Cierres temporales: añadir "Vacaciones 1-15 agosto" → se guarda
      en `closures[]`.
- [ ] Accesibilidad con teclado: navegar por Tab entre todos los
      campos, incluido el mapa (focus visible en los controles de
      zoom). Sin ratón se puede hacer zoom con `+` y `-` y pan con
      flechas cuando el foco está en el mapa.
- [ ] Lector de pantalla: el mapa lee su `aria-label` descriptivo; las
      coordenadas están disponibles como texto debajo del mapa.
- [ ] Móvil (viewport < 900px): el layout pasa a una columna
      (dirección postal debajo del mapa en vez de al lado).
- [ ] Copy: todos los textos del paso 3 tienen acentos correctos
      (Ubicación, Dirección, Teléfono, Inglés, etc.).
