# DTI O Salnés — Presentación de Avance (E1)
## Sesión de control · Marzo 2026

**Proyecto:** DTI Salnés: Nodo de Integración PID y Análisis de Datos Turísticos
**Expediente:** 8/2026
**Financiación:** Unión Europea — NextGenerationEU (PRTR, Componente 14)
**Adjudicatario:** [Nombre empresa]
**Cliente:** Mancomunidad de O Salnés

---

## 1. Resumen ejecutivo

Hemos desarrollado una **plataforma completa de gestión turística inteligente** para la Mancomunidad de O Salnés, compuesta por tres módulos principales:

1. **CMS de administración** — Panel privado para que los técnicos de turismo gestionen todos los recursos turísticos de la comarca
2. **Web pública turística** — Portal multilingüe que los turistas utilizan para descubrir O Salnés
3. **API de datos abiertos** — Capa de datos compatible con el estándar PID de SEGITTUR

Todo el sistema está **desplegado en producción** y accesible online:

| Módulo | URL |
|--------|-----|
| Web turística | https://osalnes.pages.dev |
| CMS administración | https://osalnes-cms.pages.dev |
| API pública | https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api |

**Credenciales de acceso al CMS:**
- Email: `admin@osalnes.gal`
- Contraseña: `Admin2026!`

---

## 2. Qué hemos construido

### 2.1 CMS de Administración (Panel de gestión)

El CMS es el corazón operativo de la plataforma. Permite a los técnicos de turismo de la Mancomunidad gestionar todo el contenido sin necesidad de conocimientos técnicos.

**Pantalla de login:**
- Diseño profesional con fotografía de la costa de O Salnés
- Textos en gallego ("Acceso ao panel", "Contrasinal")
- Logo de la Mancomunidade de O Salnés
- Mención a la financiación europea (NextGenerationEU)

**Dashboard (Panel de control):**
- 7 tarjetas KPI: recursos totales, publicados, en revisión, borradores, archivados, municipios, categorías
- **6 indicadores UNE 178502** con gráficos circulares y nota A/B/C/D:
  - Índice de digitalización (67%)
  - Índice de multilingüismo (43%)
  - Índice de geolocalización (100%)
  - Actualización últimos 30 días (100%)
  - Actualización últimos 90 días (100%)
  - Interoperabilidad PID (pendiente de primer export)
- Barras de calidad del dato: coordenadas, imágenes, descripciones
- Completitud de traducciones por idioma (ES, GL, EN, FR, PT)
- Distribución de recursos por municipio y por tipología
- Registro de actividad reciente (trazabilidad UNE 178502)
- Alertas de contenido incompleto

**Gestión de recursos turísticos:**
- Listado con filtros por tipología, estado y búsqueda por nombre
- Badges de color por tipo: azul (alojamiento), verde (restauración), amarillo (atracciones), morado (eventos)
- Formulario completo de creación/edición con:
  - Datos básicos: nombre, slug, tipología, municipio
  - Ubicación: latitud, longitud, dirección, código postal
  - Contacto: teléfono, email, web, redes sociales
  - Clasificación UNE 178503: tipos de turista, rating, gastronomía
  - Contenido multilingüe: nombre y descripción en 5 idiomas (ES, GL, EN, FR, PT)
  - SEO: título y descripción para buscadores
  - **Traducción automática**: botones "Traducir a GL", "Traducir a EN/FR/PT" que generan traducciones desde el castellano con un click
- Flujo editorial: Borrador → Revisión → Publicado → Archivado
- Subida de fotografías y documentos adjuntos
- Relaciones entre recursos (UNE 178503: "cerca de", "complementa", "incluye"...)

**Otras secciones del CMS:**
- **Categorías**: gestión jerárquica (qué ver, qué hacer, dónde comer, dónde dormir, agenda, información)
- **Productos turísticos**: paquetes que agrupan varios recursos (ej: Ruta del Albariño)
- **Páginas editoriales**: contenido libre tipo "Sobre nosotros", "Información práctica"
- **Navegación**: gestión de menús (cabecera, pie de página, lateral)
- **Usuarios**: gestión de roles (administrador, editor, validador, técnico, analítica) con permisos diferenciados
- **Exportaciones**: exportación a Plataforma Inteligente de Destinos (PID) y Data Lake

**Aspectos visuales del CMS:**
- Tipografía Source Sans 3 (Google Fonts) — aspecto institucional
- Barra lateral con gradiente azul O Salnés
- Favicon con logo de la Mancomunidade
- Skeleton loading (animaciones de carga profesionales)
- Diseño responsive (adaptable a tablet)

### 2.2 Web Pública Turística

La web que ve el turista cuando visita O Salnés online.

**Página principal:**
- Sección hero con recursos destacados
- Categorías principales
- Municipios de la comarca
- Próximos eventos
- Datos estructurados JSON-LD para Google (SEO)

**Secciones disponibles:**
- **Qué ver**: playas, monumentos, miradores, museos, iglesias
- **Qué hacer**: rutas, deportes, enoturismo, gastronomía, actividades marítimas
- **Directorio**: todos los recursos con filtros por tipo y municipio
- **Mapa interactivo**: mapa Leaflet con marcadores codificados por color según tipología (alojamiento azul, restauración naranja, atracciones verde, eventos morado, transporte gris, servicios rojo), con leyenda
- **Buscador**: búsqueda de texto completo en el catálogo
- **Agenda**: eventos y festivales
- **Noticias**: artículos y novedades
- **Información práctica**: datos útiles para el visitante

**Detalle de recurso:**
- Nombre, descripción, dirección, contacto, horarios
- Enlace a Google Maps
- Redes sociales
- Datos estructurados schema.org (JSON-LD) para SEO
- Breadcrumbs para navegación

**Multilingüe:**
- 5 idiomas: Español, Gallego, Inglés, Francés, Portugués
- Detección automática del idioma del navegador
- Selector de idioma en la cabecera
- Contenido traducido (no traducción automática del navegador)

**Accesibilidad:**
- Skip links para navegación con teclado
- Etiquetas ARIA en todos los elementos interactivos
- Objetivos táctiles mínimos de 44x44px
- Soporte de movimiento reducido
- Modo de alto contraste

**SEO:**
- Meta tags dinámicos (título, descripción, Open Graph, Twitter Cards)
- Sitemap XML dinámico
- robots.txt
- URLs canónicas por idioma
- Alternates hreflang para los 5 idiomas

### 2.3 API de Datos Abiertos

Capa de servicios que conecta el CMS con la Web y permite la interoperabilidad con sistemas externos.

**API pública (sin autenticación):**
- Listado de recursos turísticos con filtros (tipo, municipio, idioma, paginación)
- Detalle de recurso por slug o ID
- Tipologías disponibles (77 tipos UNE 178503)
- Categorías jerárquicas
- Municipios de O Salnés (8 + 2 especiales)
- Páginas editoriales
- Menús de navegación
- Zonas geográficas
- Eventos con filtro de fechas
- Recursos para mapa (filtro por bounding box geográfico)
- Búsqueda full-text
- **Exportación JSON-LD** compatible con schema.org y PID SEGITTUR

**API administrativa (con autenticación JWT):**
- CRUD completo de recursos, categorías, productos, páginas, navegación, usuarios
- Subida y gestión de multimedia (fotos, vídeos, documentos)
- Gestión de relaciones entre recursos
- Dashboard con estadísticas e indicadores UNE 178502
- Exportaciones PID / Data Lake
- Perfil de usuario autenticado

**API GraphQL** (compatible PID SEGITTUR):
- Queries por tipo: placesByFilter, hotelsByFilter, beachesByFilter, restaurantsByFilter, eventsByFilter
- Formato estándar SEGITTUR con LocalizedValue, Location, Contact, Media

### 2.4 Asistente Turístico IA

Módulo de inteligencia artificial integrado en la web pública.

- **Chatbot conversacional** accesible desde un botón flotante
- Basado en el catálogo real de recursos del CMS (no inventa información)
- Recomienda recursos según las preguntas del turista
- Sugiere rutas ordenadas geográficamente
- Modo producción: Claude Haiku (Anthropic) para respuestas naturales
- Modo demo: respuestas inteligentes basadas en keywords del catálogo
- Soporte multilingüe (responde en el idioma de la web)
- Log de conversaciones para análisis posterior

### 2.5 Traducción Automática

Sistema de traducción integrado en el CMS.

- Botones "Traducir a GL/EN/FR/PT" en el formulario de recursos
- Traducción desde castellano con un click
- Infraestructura preparada para 3 proveedores: LibreTranslate (gratuito), DeepL (calidad premium), mock (demo)
- Cola de trabajos de traducción asíncrona (para traducción masiva en batch)
- Tabla de jobs con reintentos automáticos y control de errores

---

## 3. Cumplimiento normativo

### 3.1 UNE 178503 — Semántica aplicada a DTI

| Requisito | Estado | Detalle |
|-----------|--------|---------|
| Vocabulario schema.org | ✅ Cumplido | Todos los recursos usan clases schema.org |
| 77 tipologías turísticas | ✅ Cumplido | Catálogo completo (sec. 7.5) |
| 36 tipos de turista | ✅ Cumplido | Clasificación por viajero, actividad, motivación, producto (sec. 7.6) |
| 24 tipos de cocina | ✅ Cumplido | Gastronomía especializada (sec. 7.7) |
| URIs únicas | ✅ Cumplido | Formato `osalnes:recurso:{slug}` |
| Geolocalización | ✅ Cumplido | PostGIS con coordenadas GPS |
| Multilingüismo | ✅ Cumplido | 5 idiomas (ES, GL, EN, FR, PT) |
| Relaciones entre recursos | ✅ Cumplido | 6 tipos de relación |
| Exportación JSON-LD | ✅ Cumplido | Endpoint `/export/jsonld` con schema.org |

### 3.2 UNE 178502 — Indicadores y herramientas DTI

| Indicador | Estado | Valor actual |
|-----------|--------|-------------|
| Índice de digitalización | ✅ Implementado | 67% |
| Índice de multilingüismo | ✅ Implementado | 43% |
| Índice de geolocalización | ✅ Implementado | 100% |
| Índice de actualización (30d) | ✅ Implementado | 100% |
| Índice de actualización (90d) | ✅ Implementado | 100% |
| Índice de interoperabilidad | ✅ Implementado | Pendiente primer export |
| Trazabilidad de cambios | ✅ Implementado | Log de auditoría |
| Calidad del dato | ✅ Implementado | Dashboard con métricas |

### 3.3 Interoperabilidad PID SEGITTUR

| Requisito | Estado |
|-----------|--------|
| API GraphQL compatible | ✅ Desplegada |
| Formato JSON-LD schema.org | ✅ Endpoint disponible |
| Exportación a Data Lake | ✅ Módulo implementado |
| Código DTI: "osalnes" | ✅ Configurado |

---

## 4. Arquitectura técnica

```
┌──────────────────────┐    ┌──────────────────────┐
│  Web Turística       │    │  CMS Administración  │
│  Next.js 14 (SSR)    │    │  React + Vite        │
│  Cloudflare Pages    │    │  Cloudflare Pages    │
│  osalnes.pages.dev   │    │  osalnes-cms.pages.dev│
└──────────┬───────────┘    └──────────┬───────────┘
           │                           │
           └─────────────┬─────────────┘
                         │ HTTPS
         ┌───────────────┴───────────────┐
         │  Supabase Edge Functions      │
         │  (6 funciones Deno)           │
         │                               │
         │  /api          ← público      │
         │  /admin        ← autenticado  │
         │  /assistant    ← IA turística │
         │  /auto-translate ← traducciones│
         ├───────────────────────────────┤
         │  Supabase                     │
         │  - PostgreSQL + PostGIS       │
         │  - Auth (JWT)                 │
         │  - Storage (multimedia)       │
         └───────────────────────────────┘
```

**Decisiones tecnológicas clave:**
- **Cloudflare Pages**: hosting global con CDN, sin coste de servidor, deploy automático desde GitHub
- **Supabase**: PostgreSQL gestionado con autenticación, almacenamiento de ficheros y edge functions incluidos
- **Next.js con Edge Runtime**: renderizado en el servidor para SEO óptimo, ejecutado en la red edge de Cloudflare (latencia mínima)
- **TypeScript en todo el stack**: seguridad de tipos desde la base de datos hasta la interfaz de usuario

---

## 5. Datos de demostración

La plataforma contiene **15 recursos turísticos reales** de O Salnés:

| Recurso | Tipo | Municipio |
|---------|------|-----------|
| Playa de A Lanzada | Playa | Sanxenxo |
| Playa de Areas | Playa | Sanxenxo |
| Playa de La Barrosa | Playa | Sanxenxo |
| Playa de O Vao | Playa | Vilagarcía |
| Parador de Cambados | Hotel | Cambados |
| Hotel Spa Nanín Playa | Hotel | Sanxenxo |
| Camping Paisaxe II | Camping | O Grove |
| Restaurante Yayo Daporta | Restaurante (★★★★★) | Cambados |
| Restaurante D'Berto | Restaurante (★★★) | O Grove |
| Marisquería Pepe Vieira | Restaurante (★★★★★) | Ribadumia |
| Pazo de Fefiñáns | Monumento | Cambados |
| Puente de A Illa de Arousa | Atracción | A Illa de Arousa |
| Torre de San Sadurniño | Monumento | Cambados |
| Mirador de A Siradella | Mirador | Sanxenxo |
| Festa do Albariño | Festival | Cambados |

Todos con coordenadas GPS, contacto, horarios, descripciones en español y gallego.

**Municipios configurados:** Cambados, O Grove, A Illa de Arousa, Meaño, Meis, Ribadumia, Sanxenxo, Vilagarcía de Arousa, Vilanova de Arousa.

**Categorías configuradas:** Qué ver (playas, patrimonio, naturaleza, miradores, museos, iglesias), Qué hacer (rutas, deportes, enoturismo, gastronomía, actividades marítimas), Dónde comer, Dónde dormir, Agenda, Información.

---

## 6. Flujo de demostración sugerido

### Acto 1: CMS — "Así trabaja el técnico de turismo" (5 min)

1. Abrir `https://osalnes-cms.pages.dev` → Pantalla de login con foto de O Salnés
2. Iniciar sesión con `admin@osalnes.gal`
3. Mostrar el **Dashboard**: KPIs, indicadores UNE 178502, calidad del dato
4. Ir a **Recursos** → Mostrar los 15 recursos con badges de color
5. Crear un nuevo recurso: **Bodega Martín Códax**
   - Tipología: Winery
   - Municipio: Cambados
   - Coordenadas: 42.5092, -8.8156
   - Descripción en castellano: "Bodega cooperativa emblema del vino Albariño de las Rías Baixas"
   - Click en **"Traducir a GL"** → aparece la traducción automática
6. Guardar → Cambiar estado a "Publicado"

### Acto 2: Web — "Así lo ve el turista" (5 min)

1. Abrir `https://osalnes.pages.dev` → Página de inicio multilingüe
2. Navegar por **Qué ver** → Playas, monumentos
3. Abrir detalle de **Playa de A Lanzada** → Contacto, horarios, mapa
4. Ir al **Mapa interactivo** → Marcadores de colores por toda la comarca
5. Usar el **Buscador** → Buscar "Albariño"
6. Cambiar idioma a **Français** → Todo el contenido cambia

### Acto 3: Diferenciadores técnicos (2 min)

1. Mostrar la **exportación JSON-LD** → Datos abiertos estándar
2. Mencionar compatibilidad **PID SEGITTUR** vía GraphQL
3. Mostrar los **indicadores UNE 178502** en el Dashboard
4. Mencionar el **Asistente IA** turístico integrado

---

## 7. Próximos pasos (Entregable 2)

Funcionalidades planificadas para la siguiente fase:

| Funcionalidad | Prioridad | Descripción |
|--------------|-----------|-------------|
| Traducción con DeepL/IA | Alta | Conectar traducción automática real (ES→GL/EN/FR/PT) |
| Horarios estructurados | Alta | Editor visual de horarios tipo Google Maps |
| Campos de fecha para eventos | Alta | Fecha inicio/fin en recursos tipo evento |
| Panel de analytics del Asistente IA | Media | Estadísticas de conversaciones y preguntas frecuentes |
| Productos con recursos asociados | Media | Vincular recursos a productos turísticos |
| Modo alto contraste (accesibilidad) | Media | Toggle WCAG 2.1 AA en el CMS |
| Notificaciones push | Baja | Alertas a editores cuando hay contenido pendiente de revisión |
| App móvil | Baja | PWA para consulta offline del catálogo turístico |

---

## 8. Métricas del proyecto

| Métrica | Valor |
|---------|-------|
| Líneas de código | ~15.000 |
| Ficheros fuente | ~80 |
| Endpoints API | 30+ (público + admin) |
| Páginas web | 12 rutas × 5 idiomas = 60+ páginas |
| Recursos demo | 15 recursos reales |
| Municipios | 9 configurados |
| Tipologías | 77 (catálogo UNE 178503 completo) |
| Idiomas | 5 (ES, GL, EN, FR, PT) |
| Edge Functions | 4 desplegadas (api, admin, assistant, auto-translate) |
| Tiempo de carga web | <2s (Edge Runtime global) |

---

## 9. Tecnologías utilizadas

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend Web | Next.js 14, React 18, TypeScript | SEO, SSR, multilingüe |
| Frontend CMS | Vite 6, React 18, TypeScript | SPA rápida para administración |
| API | Supabase Edge Functions (Deno) | Sin servidor, escalable, bajo coste |
| Base de datos | PostgreSQL + PostGIS (Supabase) | Geoespacial, relacional, robusto |
| Autenticación | Supabase Auth (JWT) | Estándar, seguro, 5 roles |
| Almacenamiento | Supabase Storage | Fotos, documentos, CDN incluido |
| Hosting | Cloudflare Pages | CDN global, deploy automático, gratuito |
| IA | Claude Haiku (Anthropic) | Asistente turístico conversacional |
| Mapas | Leaflet + OpenStreetMap | Open source, sin coste de licencia |
| Tipografía | Source Sans 3 (Google Fonts) | Aspecto institucional |
| Estándares | UNE 178502, UNE 178503, schema.org | Cumplimiento normativo DTI |

---

*Documento preparado para la sesión de control E1 — Marzo 2026*
*Mancomunidad de O Salnés · Financiado por la Unión Europea — NextGenerationEU (PRTR, Componente 14)*
