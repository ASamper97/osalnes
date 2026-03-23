# Guía de Despliegue — DTI Salnés

## Arquitectura de producción

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Web (SSR)  │    │  CMS (SPA)   │    │  API (REST)  │
│   Next.js    │    │  Vite+React  │    │  Express     │
│   Vercel     │    │  Vercel      │    │ Vercel/Render│
│   :3000      │    │  :3002       │    │  :3001       │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                    ┌──────┴───────┐
                    │   Supabase   │
                    │ DB+Auth+Store│
                    │   (cloud)    │
                    └──────────────┘
```

## Requisitos previos

- Cuenta en [Vercel](https://vercel.com) (gratuita)
- Proyecto Supabase ya configurado
- Repositorio GitHub conectado a Vercel

---

## 1. Web pública (Next.js → Vercel)

### Crear proyecto en Vercel
1. New Project → Import `ASamper97/osalnes`
2. **Root Directory**: `packages/web`
3. **Framework Preset**: Next.js (auto-detectado)
4. Vercel leerá el `vercel.json` automáticamente

### Variables de entorno
| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://osalnes-api.vercel.app/api/v1` (o la URL de tu API) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu anon key de Supabase |
| `NEXT_PUBLIC_SITE_URL` | `https://turismo.osalnes.gal` (tu dominio) |

---

## 2. CMS Admin (Vite SPA → Vercel)

### Crear proyecto en Vercel
1. New Project → Import `ASamper97/osalnes`
2. **Root Directory**: `packages/cms`
3. **Framework Preset**: Vite
4. El `vercel.json` configura SPA routing automáticamente

### Variables de entorno
| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://osalnes-api.vercel.app/api/v1` |
| `VITE_SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Tu anon key de Supabase |

> **Nota**: Las variables `VITE_*` se inyectan en build time. Si las cambias, necesitas re-deploy.

---

## 3. API (Express → Vercel o Render)

### Opción A: Vercel Serverless

1. New Project → Import `ASamper97/osalnes`
2. **Root Directory**: `packages/api`
3. Vercel detectará el `vercel.json` y usará el serverless adapter

### Opción B: Render.com (recomendado para API persistente)

1. New Web Service → Connect `ASamper97/osalnes`
2. Render detectará el `render.yaml` automáticamente
3. O configura manualmente:
   - **Build Command**: `npm install && npm run build -w packages/shared && npm run build -w packages/api`
   - **Start Command**: `node packages/api/dist/server.js`

### Variables de entorno (ambas opciones)
| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `API_PORT` | `3001` |
| `API_HOST` | `0.0.0.0` |
| `SUPABASE_URL` | `https://oduglbxjcmmdexwplzvw.supabase.co` |
| `SUPABASE_ANON_KEY` | Tu anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Tu service role key |
| `CORS_ORIGINS` | `https://turismo.osalnes.gal,https://cms.osalnes.gal` |
| `LOG_LEVEL` | `info` |

---

## 4. Supabase (ya configurado)

- **URL**: `https://oduglbxjcmmdexwplzvw.supabase.co`
- **Dashboard**: https://supabase.com/dashboard
- DB, Auth, y Storage ya están operativos
- Asegúrate de tener las migraciones ejecutadas (001-004)

---

## CORS en producción

Actualiza `CORS_ORIGINS` en la API con los dominios reales:
```
https://turismo.osalnes.gal,https://cms.osalnes.gal
```

## Dominios personalizados

En Vercel → Settings → Domains:
- Web: `turismo.osalnes.gal`
- CMS: `cms.osalnes.gal`
- API: `api.osalnes.gal`

---

## Comandos útiles

```bash
# Build local completo
npm run build

# Dev local (los 3 servicios)
npm run dev

# Solo un servicio
npm run dev:api
npm run dev:web
npm run dev:cms
```
