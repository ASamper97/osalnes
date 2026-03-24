# Guía de Despliegue — DTI Salnés

## Arquitectura de producción

```
┌──────────────────┐    ┌──────────────────┐
│   Web (SSR)      │    │   CMS (SPA)      │
│   Next.js        │    │   Vite + React   │
│   Cloudflare     │    │   Cloudflare     │
│   Pages          │    │   Pages          │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │  Supabase Edge Fns    │
         │  api (público)        │
         │  admin (autenticado)  │
         ├───────────────────────┤
         │  Supabase             │
         │  DB + Auth + Storage  │
         │  (cloud)              │
         └───────────────────────┘
```

## Requisitos previos

- Cuenta en [Cloudflare](https://dash.cloudflare.com) (gratuita)
- Proyecto Supabase configurado (`oduglbxjcmmdexwplzvw`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
- Repositorio GitHub: `ASamper97/osalnes`

---

## 1. API — Supabase Edge Functions

Las Edge Functions reemplazan la API Express. Están en `supabase/functions/`.

### Desplegar funciones

```bash
# Login en Supabase
supabase login

# Link al proyecto
supabase link --project-ref oduglbxjcmmdexwplzvw

# Desplegar todas las funciones
supabase functions deploy api --no-verify-jwt
supabase functions deploy admin --no-verify-jwt
```

> `--no-verify-jwt` porque verificamos manualmente en la función `admin`.

### URLs resultantes

| Función | URL |
|---------|-----|
| `api` (pública) | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api` |
| `admin` (auth) | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/admin` |

### Variables de entorno (automáticas)

Supabase inyecta automáticamente:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Para CORS personalizado (opcional):
```bash
supabase secrets set CORS_ORIGINS="https://turismo.osalnes.gal,https://cms.osalnes.gal"
```

### Dev local

```bash
# Servir funciones localmente (requiere Docker)
supabase functions serve

# Las funciones estarán en http://localhost:54321/functions/v1/api
# y http://localhost:54321/functions/v1/admin
```

---

## 2. Web pública (Next.js → Cloudflare Pages)

### Crear proyecto en Cloudflare

1. Dashboard → Pages → Create a project → Connect to Git
2. Seleccionar repositorio `ASamper97/osalnes`
3. Configuración de build:
   - **Build command**: `npm install && npm run build -w packages/shared && npm run build -w packages/web`
   - **Build output directory**: `packages/web/.next`
   - **Root directory**: `/` (raíz del monorepo)
   - **Framework preset**: Next.js

### Variables de entorno

| Variable | Valor producción |
|----------|-----------------|
| `NEXT_PUBLIC_API_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu anon key |
| `NEXT_PUBLIC_SITE_URL` | `https://turismo.osalnes.gal` |
| `NODE_VERSION` | `20` |

### Dominio personalizado

En Cloudflare Pages → Custom domains → `turismo.osalnes.gal`

---

## 3. CMS Admin (Vite SPA → Cloudflare Pages)

### Crear proyecto en Cloudflare

1. Dashboard → Pages → Create a project → Connect to Git
2. Seleccionar repositorio `ASamper97/osalnes`
3. Configuración de build:
   - **Build command**: `npm install && npm run build -w packages/shared && npm run build -w packages/cms`
   - **Build output directory**: `packages/cms/dist`
   - **Root directory**: `/`

### Variables de entorno

| Variable | Valor producción |
|----------|-----------------|
| `VITE_API_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api` |
| `VITE_ADMIN_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/admin` |
| `VITE_SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Tu anon key |

> **Nota**: Las variables `VITE_*` se inyectan en build time. Si las cambias, necesitas re-deploy.

### SPA routing

El archivo `packages/cms/public/_redirects` configura automáticamente el fallback a `index.html` para SPA routing.

### Dominio personalizado

En Cloudflare Pages → Custom domains → `cms.osalnes.gal`

---

## 4. Supabase (ya configurado)

- **URL**: `https://oduglbxjcmmdexwplzvw.supabase.co`
- **Dashboard**: https://supabase.com/dashboard
- DB, Auth, y Storage ya están operativos
- Asegúrate de tener las migraciones ejecutadas (001-004)

---

## CORS en producción

Las Edge Functions leen `CORS_ORIGINS` para permitir los dominios correctos:

```bash
supabase secrets set CORS_ORIGINS="https://turismo.osalnes.gal,https://cms.osalnes.gal"
```

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Dev local completo (Express API + Next.js + CMS)
npm run dev

# Solo un servicio
npm run dev:api    # Express en :3001
npm run dev:web    # Next.js en :3000
npm run dev:cms    # Vite en :3002

# Edge Functions locales (alternativa a Express)
supabase functions serve
```

### Flujo de trabajo recomendado

1. **Dev**: Usa `npm run dev` (Express API). Es más rápido para iterar.
2. **Pre-deploy**: Prueba con `supabase functions serve` para verificar Edge Functions.
3. **Deploy**: `supabase functions deploy` + push a GitHub (Cloudflare auto-deploy).

---

## Resumen de URLs

| Servicio | Dev | Producción |
|----------|-----|------------|
| Web | `http://localhost:3000` | `https://turismo.osalnes.gal` |
| CMS | `http://localhost:3002` | `https://cms.osalnes.gal` |
| API pública | `http://localhost:3001/api/v1` | `.../functions/v1/api` |
| API admin | `http://localhost:3001/api/v1/admin` | `.../functions/v1/admin` |
| Supabase | `https://oduglbxjcmmdexwplzvw.supabase.co` | (mismo) |
