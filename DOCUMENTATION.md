# Documentación Técnica — DTI Salnés

**Proyecto**: Directorio Turístico Inteligente de la Mancomunidad de O Salnés
**Repositorio**: `ASamper97/osalnes`
**Última actualización**: 2026-03-24

---

## Índice

1. [Descripción del proyecto](#1-descripción-del-proyecto)
2. [Arquitectura](#2-arquitectura)
3. [Estructura del monorepo](#3-estructura-del-monorepo)
4. [Base de datos (Supabase)](#4-base-de-datos-supabase)
5. [API — Supabase Edge Functions](#5-api--supabase-edge-functions)
6. [Web pública (Next.js)](#6-web-pública-nextjs)
7. [CMS Administración (Vite + React)](#7-cms-administración-vite--react)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Despliegue en producción](#9-despliegue-en-producción)
10. [Desarrollo local](#10-desarrollo-local)
11. [Historial de sesiones de trabajo](#11-historial-de-sesiones-de-trabajo)

---

## 1. Descripción del proyecto

DTI Salnés es una plataforma web de turismo inteligente para la Mancomunidad de O Salnés (Galicia). Consta de:

- **Web pública** (`turismo.osalnes.gal`): catálogo multilingüe (ES/GL) de recursos turísticos con mapa interactivo, búsqueda full-text y páginas de detalle SEO-friendly.
- **CMS de administración** (`cms.osalnes.gal`): panel privado para gestionar recursos, categorías, navegación, páginas CMS, activos multimedia y usuarios.
- **API REST** (`supabase/functions/`): Edge Functions Deno en Supabase que sirven los datos públicos y el CRUD administrativo.
- **Base de datos**: Supabase (PostgreSQL) con autenticación JWT y almacenamiento de ficheros (Storage).

### Estándar de datos

Los recursos turísticos siguen el vocabulario **schema.org** con extensiones **UNE 178503** (estándar español para datos turísticos abiertos):

- Cada recurso tiene un `uri` único (e.g. `https://turismo.osalnes.gal/recurso/<uuid>`)
- El campo `rdfType` mapea tipologías a clases schema.org: `schema:LodgingBusiness`, `schema:Restaurant`, `schema:TouristAttraction`, etc.
- Todos los campos textuales son multilingüe: `{ "es": "...", "gl": "..." }`

---

## 2. Arquitectura

### Producción

```
┌──────────────────────┐    ┌──────────────────────┐
│  Web (SSR)           │    │  CMS (SPA)           │
│  Next.js 15          │    │  Vite + React 18     │
│  Cloudflare Pages    │    │  Cloudflare Pages    │
│  turismo.osalnes.gal │    │  cms.osalnes.gal     │
└──────────┬───────────┘    └──────────┬───────────┘
           │                           │
           └─────────────┬─────────────┘
                         │ HTTPS
         ┌───────────────┴───────────────┐
         │  Supabase Edge Functions      │
         │  (Deno runtime)               │
         │                               │
         │  /functions/v1/api    ← público │
         │  /functions/v1/admin  ← auth   │
         ├───────────────────────────────┤
         │  Supabase (oduglbxjcmmdexwplzvw) │
         │  - PostgreSQL (DB)            │
         │  - Auth (JWT)                 │
         │  - Storage (media/docs)       │
         └───────────────────────────────┘
```

### Desarrollo local

```
Next.js :3000  →  Express API :3001/api/v1
Vite    :3002  →  Express API :3001/api/v1  (proxy Vite)
                  (o supabase functions serve :54321)
```

### URLs por entorno

| Servicio | Desarrollo | Producción |
|----------|-----------|-----------|
| Web pública | `http://localhost:3000` | `https://turismo.osalnes.gal` |
| CMS admin | `http://localhost:3002` | `https://cms.osalnes.gal` |
| API pública | `http://localhost:3001/api/v1` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api` |
| API admin | `http://localhost:3001/api/v1/admin` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/admin` |
| Supabase | `https://oduglbxjcmmdexwplzvw.supabase.co` | (mismo) |

---

## 3. Estructura del monorepo

```
osalnes-dti/
├── package.json              # Raíz del workspace npm
├── DEPLOY.md                 # Guía de despliegue
├── DOCUMENTATION.md          # Este fichero
├── .env.example              # Plantilla de variables de entorno
│
├── packages/
│   ├── shared/               # Tipos y constantes compartidos
│   │   ├── src/
│   │   │   ├── types.ts      # Interfaces TypeScript del dominio
│   │   │   └── constants.ts  # RDF types, municipios, tipologías
│   │   └── package.json
│   │
│   ├── api/                  # Express API (desarrollo local)
│   │   ├── src/
│   │   │   ├── app.ts        # Express app + middlewares
│   │   │   ├── routes/
│   │   │   │   ├── public.ts # Rutas públicas
│   │   │   │   └── admin.ts  # Rutas administrativas (auth)
│   │   │   └── services/
│   │   │       └── translation.service.ts
│   │   ├── migrations/       # SQL migrations (001-004)
│   │   └── package.json
│   │
│   ├── web/                  # Next.js — Web pública
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   └── [lang]/   # Rutas i18n (es/gl)
│   │   │   │       ├── layout.tsx
│   │   │   │       ├── page.tsx        # Home
│   │   │   │       ├── mapa/page.tsx   # Mapa interactivo
│   │   │   │       ├── buscar/page.tsx # Búsqueda
│   │   │   │       ├── recurso/[slug]/ # Detalle recurso
│   │   │   │       └── categoria/[slug]/
│   │   │   ├── components/
│   │   │   │   ├── MapView.tsx         # Leaflet map (client-only)
│   │   │   │   └── ui/
│   │   │   │       ├── Header.tsx
│   │   │   │       └── Footer.tsx
│   │   │   ├── i18n/
│   │   │   │   ├── config.ts           # locales: ['es', 'gl']
│   │   │   │   ├── dictionaries.ts
│   │   │   │   └── dictionaries/
│   │   │   │       ├── es.json
│   │   │   │       └── gl.json
│   │   │   └── lib/
│   │   │       └── api-client.ts       # Fetch helpers para SSR
│   │   └── package.json
│   │
│   └── cms/                  # Vite + React — CMS admin
│       ├── src/
│       │   ├── App.tsx
│       │   ├── lib/
│       │   │   ├── api.ts      # HTTP client (public + admin split)
│       │   │   └── supabase.ts # Cliente Supabase (auth)
│       │   ├── pages/
│       │   │   ├── Login.tsx
│       │   │   ├── Resources/
│       │   │   ├── Categories/
│       │   │   ├── Navigation/
│       │   │   ├── Pages/
│       │   │   ├── Assets/
│       │   │   └── Users/
│       │   └── components/
│       ├── public/
│       │   ├── _redirects    # SPA fallback (Cloudflare Pages)
│       │   └── _headers      # Security headers
│       └── package.json
│
└── supabase/
    ├── config.toml           # Supabase CLI config
    └── functions/
        ├── deno.json         # Import map Deno
        ├── _shared/          # Helpers compartidos entre funciones
        │   ├── cors.ts       # CORS headers + json() helper
        │   ├── supabase.ts   # Admin client (service role key)
        │   ├── auth.ts       # JWT verification + role check
        │   ├── router.ts     # Path extraction + route matching
        │   └── translations.ts # Helpers de traducción multilingüe
        ├── api/
        │   └── index.ts      # API pública (Deno.serve)
        └── admin/
            └── index.ts      # API administrativa (Deno.serve)
```

---

## 4. Base de datos (Supabase)

**Proyecto Supabase**: `oduglbxjcmmdexwplzvw`
**URL**: `https://oduglbxjcmmdexwplzvw.supabase.co`

### Tablas principales

#### `recurso` — Recursos turísticos

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | Identificador único |
| `uri` | text | URI semántica schema.org |
| `slug` | text UNIQUE | URL-friendly identifier |
| `rdf_type` | text | Clase schema.org (e.g. `schema:Restaurant`) |
| `status` | text | `borrador`, `publicado`, `archivado` |
| `municipio_id` | uuid FK | Municipio del recurso |
| `latitude` | numeric | Coordenada geográfica |
| `longitude` | numeric | Coordenada geográfica |
| `street_address` | text | Dirección |
| `postal_code` | text | Código postal |
| `phone` | text | Teléfono |
| `email` | text | Email de contacto |
| `website` | text | URL web |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `traduccion` — Textos multilingüe

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `entidad_tipo` | text | `recurso`, `categoria`, `pagina`, etc. |
| `entidad_id` | uuid | ID de la entidad relacionada |
| `campo` | text | `name`, `description`, `seo_title`, etc. |
| `idioma` | text | `es`, `gl` |
| `valor` | text | Contenido traducido |

#### `tipologia` — Tipologías turísticas (UNE 178503)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `type_code` | text UNIQUE | Código interno |
| `rdf_type` | text | Clase schema.org |
| `schema_subtype` | text | Subtipo schema.org |

#### `municipio` — Municipios de O Salnés

Los 8 municipios de la Mancomunidad:
- Meaño, Vilagarcía de Arousa, Vilanova de Arousa, Cambados, Ribadumia, Sanxenxo, O Grove, Meis

#### `categoria` — Categorías de recursos

| Columna | Descripción |
|---------|-------------|
| `id`, `slug` | Identificadores |
| `parent_id` | Para jerarquía de categorías |
| `order_index` | Orden visual |

#### `menu` / `menu_item` — Navegación

Menús del sitio web con ítems anidados y orden configurable.

#### `pagina_cms` — Páginas de contenido libre

Para "Sobre nosotros", "Quiénes somos", etc. Con `status` y `slug`.

#### `activo` — Activos multimedia

Ficheros en Supabase Storage. Bucket `media`. Metadatos: `filename`, `mime_type`, `file_size`, `storage_path`, `public_url`.

#### `documento` — Documentos adjuntos a recursos

PDF, Word, etc. Bucket `documents`.

#### `usuario` — Roles de usuario

Extiende `auth.users` de Supabase:

| Columna | Descripción |
|---------|-------------|
| `id` | UUID = `auth.users.id` |
| `role` | `admin`, `editor`, `lector` |
| `active` | Acceso habilitado |

#### `relacion` — Relaciones entre recursos

`recurso_origen_id` → `recurso_destino_id` con `tipo_relacion`.

#### `exportacion` — Jobs de exportación

Estado de exportaciones JSON-LD / DataLake: `pendiente`, `procesando`, `completado`, `error`.

#### `producto` — Productos turísticos compuestos

Paquetes que agrupan varios recursos.

### Migraciones

Las migraciones están en `packages/api/migrations/`:
- `001_initial_schema.sql` — Tablas base
- `002_*.sql` — Extensiones del esquema
- `003_*.sql` — Navegación y páginas
- `004_*.sql` — Ajustes adicionales

---

## 5. API — Supabase Edge Functions

Las Edge Functions corren en **Deno** (no Node.js) y reemplazan el Express API en producción.

### Helpers compartidos (`supabase/functions/_shared/`)

#### `cors.ts`
Gestión de CORS. Lee `CORS_ORIGINS` del entorno para producción.

```typescript
getCorsHeaders(req: Request): Record<string, string>
json(data: unknown, status = 200, req?: Request): Response
handleCors(req: Request): Response | null  // devuelve 204 para OPTIONS
```

#### `supabase.ts`
Cliente admin singleton con `SUPABASE_SERVICE_ROLE_KEY`.

```typescript
getAdminClient(): SupabaseClient
```

#### `auth.ts`
Verifica JWT de Supabase Auth y comprueba rol en tabla `usuario`.

```typescript
interface AuthUser { id: string; email: string; role: string; active: boolean; }
verifyAuth(req: Request): Promise<AuthUser>     // lanza { status, message } si falla
requireRole(user: AuthUser, ...roles: string[]): void  // lanza 403 si no cumple
```

#### `router.ts`
Extracción de path y matching de rutas con parámetros dinámicos.

```typescript
routePath(url: URL, functionName: string): string
// Ejemplo: URL ".../api/resources/123" → "/resources/123"

matchRoute(pattern: string, path: string): Record<string, string> | null
// Ejemplo: matchRoute('/resources/:id', '/resources/123') → { id: '123' }
```

#### `translations.ts`
Acceso a la tabla `traduccion` para campos multilingüe.

```typescript
getTranslations(entidadTipo, entidadId): Promise<Record<string, Record<string, string>>>
// → { name: { es: '...', gl: '...' }, description: { es: '...', gl: '...' } }

getTranslatedField(entidadTipo, entidadId, campo): Promise<Record<string, string>>
saveTranslations(entidadTipo, entidadId, campo, values): Promise<void>
```

### Función `api` — API pública

**URL producción**: `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api`

No requiere autenticación. Todos los endpoints son de solo lectura (GET).

| Endpoint | Descripción |
|----------|-------------|
| `GET /health` | Estado de la función |
| `GET /resources` | Lista de recursos (filtros: `status`, `type`, `municipio`, `lang`, `limit`, `offset`) |
| `GET /resources/by-slug/:slug` | Recurso por slug |
| `GET /resources/:id` | Recurso por ID |
| `GET /typologies` | Tipologías disponibles |
| `GET /categories` | Árbol de categorías |
| `GET /categories/:slug` | Categoría por slug |
| `GET /municipalities` | Municipios de O Salnés |
| `GET /pages/:slug` | Página CMS por slug |
| `GET /navigation/:menuSlug` | Menú de navegación |
| `GET /zones` | Zonas geográficas |
| `GET /events` | Eventos turísticos |
| `GET /map/resources` | Recursos con coordenadas dentro de `bounds` (SW,NE) |
| `GET /search` | Búsqueda full-text (parámetro `q`) |

**Patrón de respuesta**:
```json
// Lista: { "items": [...], "total": N }
// Detalle: { "id": "...", "name": { "es": "...", "gl": "..." }, ... }
```

### Función `admin` — API administrativa

**URL producción**: `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/admin`

Requiere header `Authorization: Bearer <jwt>`. El JWT lo emite Supabase Auth al hacer login en el CMS.

**Recursos** (`/resources`):
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/resources` | Crear recurso |
| PUT | `/resources/:id` | Actualizar recurso completo |
| PATCH | `/resources/:id/status` | Cambiar estado |
| DELETE | `/resources/:id` | Eliminar recurso |

**Activos multimedia** (`/assets`):
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/assets` | Subir fichero (multipart/form-data) |
| GET | `/assets` | Listar activos |
| DELETE | `/assets/:id` | Eliminar activo |

**Categorías, Navegación, Páginas, Relaciones, Documentos, Exportaciones, Usuarios, Productos**: CRUD completo en sus respectivos endpoints.

**Subida de ficheros en Deno** (sin multer):
```typescript
const formData = await req.formData();
const file = formData.get('file') as File;
const buffer = new Uint8Array(await file.arrayBuffer());
await sb.storage.from('media').upload(path, buffer, { contentType: file.type });
```

---

## 6. Web pública (Next.js)

**Package**: `packages/web`
**Framework**: Next.js 15 con App Router
**i18n**: Rutas `[lang]` con `es` y `gl`. Diccionarios en `src/i18n/dictionaries/`

### Rutas

| Ruta | Descripción |
|------|-------------|
| `/[lang]` | Home — hero, categorías destacadas, recursos recientes |
| `/[lang]/mapa` | Mapa interactivo Leaflet con filtros |
| `/[lang]/buscar` | Búsqueda full-text |
| `/[lang]/categoria/[slug]` | Listado de recursos por categoría |
| `/[lang]/recurso/[slug]` | Página de detalle del recurso |

### API client (`src/lib/api-client.ts`)

Fetch de datos desde el servidor (SSR). Usa `next: { revalidate: 60 }` para ISR.

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
```

En producción apunta a la Edge Function pública.

### MapView (`src/components/MapView.tsx`)

Componente cliente (`'use client'`). Cargado dinámicamente con `ssr: false` para evitar errores de Leaflet en SSR.

- Inicialización de iconos Leaflet diferida tras `typeof window !== 'undefined'`
- Filtros por tipología y municipio
- `BoundsLoader`: recarga recursos al mover el mapa
- Fallback a `/resources` si `/map/resources` no está disponible

### Configuración importante de rutas

```typescript
// packages/web/src/app/[lang]/mapa/page.tsx
export const dynamic = 'force-dynamic'; // Evita prerendering estático (Leaflet necesita window)

// packages/web/src/app/[lang]/buscar/page.tsx
// useSearchParams() debe estar en un componente envuelto en <Suspense>
```

---

## 7. CMS Administración (Vite + React)

**Package**: `packages/cms`
**Framework**: Vite 6 + React 18 + TypeScript
**Auth**: Supabase Auth (email/password) → JWT

### Cliente HTTP (`src/lib/api.ts`)

Split en dos bases para soportar Edge Functions en producción:

```typescript
const API_BASE   = import.meta.env.VITE_API_URL   || '/api/v1';
const ADMIN_BASE = import.meta.env.VITE_ADMIN_URL || `${API_BASE}/admin`;

publicFetch<T>(path, init?)   // → API_BASE + path
adminFetch<T>(path, init?)    // → ADMIN_BASE + path
adminUpload<T>(path, formData) // multipart para assets/documentos
```

En desarrollo, Vite proxea `/api` a `:3001` y `/functions` a `:54321` (supabase serve).

### Páginas del CMS

| Página | Descripción |
|--------|-------------|
| `Login` | Autenticación con Supabase Auth |
| `Resources` | CRUD de recursos turísticos |
| `Categories` | Gestión de categorías |
| `Navigation` | Menús del sitio |
| `Pages` | Páginas CMS (contenido libre) |
| `Assets` | Gestor de multimedia |
| `Users` | Gestión de usuarios y roles (solo admin) |

### Routing en Cloudflare Pages

El fichero `packages/cms/public/_redirects` configura el fallback SPA:
```
/* /index.html 200
```

---

## 8. Variables de entorno

### Web pública (`packages/web/.env.local`)

| Variable | Dev | Producción |
|----------|-----|-----------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` | (mismo) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key>` | (mismo) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://turismo.osalnes.gal` |

### CMS (`packages/cms/.env.local`)

| Variable | Dev | Producción |
|----------|-----|-----------|
| `VITE_API_URL` | `http://localhost:3001/api/v1` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api` |
| `VITE_ADMIN_URL` | `http://localhost:3001/api/v1/admin` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/admin` |
| `VITE_SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` | (mismo) |
| `VITE_SUPABASE_ANON_KEY` | `<anon key>` | (mismo) |

### Supabase Edge Functions (secrets)

Inyectadas automáticamente:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Configurar manualmente:
```bash
supabase secrets set CORS_ORIGINS="https://turismo.osalnes.gal,https://cms.osalnes.gal"
```

---

## 9. Despliegue en producción

### Prerrequisitos

- Cuenta Cloudflare (gratuita)
- Supabase CLI: `npm install -g supabase`
- Acceso al proyecto Supabase `oduglbxjcmmdexwplzvw`
- Repositorio GitHub: `ASamper97/osalnes`

### 1. Desplegar Edge Functions

```bash
supabase login
supabase link --project-ref oduglbxjcmmdexwplzvw

# Desplegar ambas funciones
supabase functions deploy api --no-verify-jwt
supabase functions deploy admin --no-verify-jwt

# Configurar CORS para producción
supabase secrets set CORS_ORIGINS="https://turismo.osalnes.gal,https://cms.osalnes.gal"
```

### 2. Web pública — Cloudflare Pages

1. Dashboard → Pages → Create a project → Connect to Git
2. Seleccionar `ASamper97/osalnes`
3. Configuración de build:
   - **Build command**: `npm install && npm run build -w packages/shared && npm run build -w packages/web`
   - **Build output directory**: `packages/web/.next`
   - **Root directory**: `/`
   - **Framework preset**: Next.js

Variables de entorno a añadir en Cloudflare:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key>` |
| `NEXT_PUBLIC_SITE_URL` | `https://turismo.osalnes.gal` |
| `NODE_VERSION` | `20` |

4. Custom domain → `turismo.osalnes.gal`

### 3. CMS — Cloudflare Pages

1. Dashboard → Pages → Create a project → Connect to Git
2. Seleccionar `ASamper97/osalnes`
3. Configuración de build:
   - **Build command**: `npm install && npm run build -w packages/shared && npm run build -w packages/cms`
   - **Build output directory**: `packages/cms/dist`
   - **Root directory**: `/`

Variables de entorno:

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api` |
| `VITE_ADMIN_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/admin` |
| `VITE_SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<anon key>` |

4. Custom domain → `cms.osalnes.gal`

> **Nota**: Las variables `VITE_*` se inyectan en build time. Si las cambias, haz re-deploy.

### 4. Flujo de despliegue continuo

- Cloudflare Pages hace auto-deploy en cada push a `main`
- Las Edge Functions se despliegan manualmente con `supabase functions deploy`

---

## 10. Desarrollo local

### Instalación inicial

```bash
git clone https://github.com/ASamper97/osalnes.git
cd osalnes-dti
npm install

# Copiar y rellenar variables de entorno
cp .env.example packages/web/.env.local
cp .env.example packages/cms/.env.local
```

### Modo rápido (Express API local)

```bash
npm run dev
# Web:  http://localhost:3000
# CMS:  http://localhost:3002
# API:  http://localhost:3001/api/v1
```

### Modo Edge Functions (para probar antes de producción)

```bash
# Terminal 1: Iniciar Edge Functions localmente (requiere Docker)
supabase functions serve

# Terminal 2: Web
npm run dev:web

# Terminal 3: CMS
npm run dev:cms
```

Las funciones estarán en:
- `http://localhost:54321/functions/v1/api`
- `http://localhost:54321/functions/v1/admin`

Asegúrate de que `.env.local` apunta a estas URLs para probar con Edge Functions en local.

### Base de datos (Express dev)

```bash
# Ejecutar migraciones (requiere PostgreSQL local o Supabase)
npm run db:migrate

# Seed inicial (municipios, tipologías)
npm run db:seed
```

### Builds de verificación

```bash
npm run build -w packages/shared
npm run build -w packages/web
npm run build -w packages/cms
```

---

## 11. Historial de sesiones de trabajo

### Sesión 1 — Arquitectura base y API Express

**Commit**: `0369255`

- Esquema de base de datos completo (migraciones 001-004)
- API Express con rutas públicas y admin
- Servicio de traducción multilingüe
- CMS básico con autenticación Supabase
- Web Next.js con rutas i18n (ES/GL)
- Workflow editorial: borrador → publicado → archivado

### Sesión 2 — Multimedia, categorías y navegación

**Commit**: `70c53fe`

- Subida de activos multimedia a Supabase Storage
- Gestión de categorías con jerarquía
- Menús de navegación configurables
- Páginas CMS (contenido libre)
- SEO: meta tags, Open Graph, sitemap, robots.txt
- Accesibilidad: skip links, aria-labels, roles semánticos

### Sesión 3 — Mapa interactivo y configuración de despliegue

**Commit**: `a1d5962`

- Mapa interactivo con Leaflet + react-leaflet
- Endpoint `/map/resources` con filtro por bounding box
- Filtros de mapa por tipología y municipio
- Configuración inicial de Cloudflare Pages
- Variables de entorno para producción

### Sesión 4 — Migración a Supabase Edge Functions (sesión actual)

**Commit**: `3657545` — 20 ficheros modificados, 2399 inserciones

**Objetivo**: Eliminar dependencia del servidor Express en producción. Toda la API pasa a correr como Deno en Supabase Edge Functions.

#### Ficheros creados

| Fichero | Descripción |
|---------|-------------|
| `supabase/config.toml` | Configuración proyecto Supabase CLI |
| `supabase/functions/deno.json` | Import map para Deno (esm.sh imports) |
| `supabase/functions/_shared/cors.ts` | CORS helpers + json() response |
| `supabase/functions/_shared/supabase.ts` | Admin client singleton |
| `supabase/functions/_shared/auth.ts` | JWT verify + role check |
| `supabase/functions/_shared/router.ts` | Path extraction + route matching |
| `supabase/functions/_shared/translations.ts` | Queries multilingüe |
| `supabase/functions/api/index.ts` | 14 endpoints públicos (Deno.serve) |
| `supabase/functions/admin/index.ts` | CRUD admin completo (Deno.serve) |
| `packages/cms/public/_redirects` | SPA routing Cloudflare Pages |
| `packages/cms/public/_headers` | Security headers Cloudflare Pages |

#### Ficheros modificados

| Fichero | Cambio |
|---------|--------|
| `packages/cms/src/lib/api.ts` | Split `API_BASE` en `API_BASE` (público) + `ADMIN_BASE` (admin) |
| `packages/cms/vite.config.ts` | Proxy `/functions` → `:54321` para dev con supabase serve |
| `packages/web/src/lib/api-client.ts` | Comentario aclarando URLs de producción vs dev |
| `packages/web/src/app/[lang]/buscar/page.tsx` | Extracción `SearchContent` + `<Suspense>` para `useSearchParams()` |
| `packages/web/src/app/[lang]/mapa/page.tsx` | Renombrar import, añadir `export const dynamic = 'force-dynamic'` |
| `packages/web/src/components/MapView.tsx` | Mover CSS Leaflet, diferir init de iconos con guard `window` |
| `packages/web/src/app/[lang]/layout.tsx` | Eliminar import CSS de Leaflet (movido a MapView.tsx) |
| `.env.example` | Añadir `VITE_ADMIN_URL` y comentarios de producción |
| `DEPLOY.md` | Reescritura completa para nueva arquitectura |

#### Errores de build solucionados

1. **`useSearchParams() should be wrapped in a suspense boundary`**
   En `/[lang]/buscar/page.tsx`. Solución: extraer componente `SearchContent` que usa `useSearchParams()` y envolverlo en `<Suspense>` en el export default.

2. **`window is not defined` durante prerendering**
   En `MapView.tsx`. Supabase inyecta el CSS de Leaflet en `layout.tsx` (servidor). Solución triple:
   - Mover `import 'leaflet/dist/leaflet.css'` a `MapView.tsx` (componente cliente)
   - Diferir `L.icon()` detrás de `typeof window === 'undefined'` guard
   - Añadir `export const dynamic = 'force-dynamic'` en `mapa/page.tsx` para skip prerendering

3. **`dynamic` redefined** (conflicto de nombres)
   En `mapa/page.tsx`. `import dynamic from 'next/dynamic'` conflictía con `export const dynamic = 'force-dynamic'`. Solución: renombrar import a `nextDynamic`.

#### Diferencias clave: Express → Deno Edge Functions

| Aspecto | Express (Node.js) | Deno Edge Function |
|---------|------------------|-------------------|
| Routing | `app.get('/resources', handler)` | `if (method === 'GET' && path === '/resources')` |
| File upload | `multer` middleware | `req.formData()` → `file.arrayBuffer()` → `Uint8Array` |
| Buffer | `Buffer.from(...)` | `new Uint8Array(...)` |
| Auth | `express-jwt` middleware | `verifyAuth(req)` manual |
| Imports | `require()` / ES modules npm | `https://esm.sh/...` |
| CORS | `cors` npm package | `getCorsHeaders()` manual |
| Serve | `app.listen(3001)` | `Deno.serve(handler)` |

---

*Documentación generada el 2026-03-24.*
