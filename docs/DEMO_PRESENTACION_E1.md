# DTI O Salnés — Presentación de Avance (E1)
## Sesión de control · Marzo 2026

**Proyecto:** DTI Salnés: Nodo de Integración PID y Análisis de Datos Turísticos
**Expediente:** 8/2026
**Financiación:** Unión Europea — NextGenerationEU (PRTR, Componente 14)
**Adjudicatario:** [Nombre empresa]
**Cliente:** Mancomunidad de O Salnés

---

## 1. Resumen ejecutivo

Hemos desarrollado una **plataforma completa de gestión turística inteligente** para la Mancomunidad de O Salnés, compuesta por tres módulos principales más un motor de inteligencia artificial:

1. **CMS de administración** — Panel privado para que los técnicos de turismo gestionen todos los recursos turísticos de la comarca
2. **Web pública turística** — Portal multilingüe que los turistas utilizan para descubrir O Salnés
3. **API de datos abiertos** — Capa de datos compatible con el estándar PID de SEGITTUR
4. **ARIA (A Ría + IA)** — Asistente de inteligencia artificial integrado, con Gemini de Google

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
- Diseño hero con fotografía de la costa de O Salnés a pantalla completa
- Panel de login limpio a la derecha con logo centrado
- Textos en gallego ("Acceso ao panel", "Contrasinal")
- Logo de la Mancomunidade de O Salnés
- Mención a la financiación europea (NextGenerationEU)

**Dashboard (Panel de control):**
- 7 tarjetas KPI: recursos totales, publicados, en revisión, borradores, archivados, municipios, categorías
- **6 indicadores UNE 178502** con gráficos circulares SVG y nota A/B/C/D:
  - Índice de digitalización (67%)
  - Índice de multilingüismo (43%)
  - Índice de geolocalización (100%)
  - Actualización últimos 30 días (100%)
  - Actualización últimos 90 días (100%)
  - Interoperabilidad PID (pendiente de primer export)
- Barras de calidad del dato: coordenadas, imágenes, descripciones
- Completitud de traducciones por idioma (ES, GL, EN, FR, PT)
- Distribución de recursos por municipio y por tipología
- **Alertas automáticas** de contenido incompleto (faltan imágenes, descripciones, etc.)
- Registro de actividad reciente (trazabilidad UNE 178502)

**Gestión de recursos turísticos:**
- Listado con filtros por tipología, estado y **búsqueda server-side por nombre**
- Badges de color por tipo: azul (alojamiento), verde (restauración), amarillo (atracciones), morado (eventos)
- **Generación de códigos QR** para cada recurso (descargar PNG o imprimir con diseño de marca)
- Formulario completo de creación/edición con:
  - Datos básicos: nombre, slug, tipología primaria + **tipologías secundarias** (multi-select)
  - Ubicación: municipio, **zona geográfica**, latitud, longitud, dirección, código postal
  - Contacto: teléfono, email, web, redes sociales
  - Clasificación UNE 178503: tipos de turista, rating, gastronomía
  - Contenido multilingüe: nombre y descripción en 5 idiomas (ES, GL, EN, FR, PT)
  - SEO: título y descripción para buscadores
  - **Traducción automática con IA (Gemini)**: botones "Traducir a GL", "Traducir a EN/FR/PT" que generan traducciones reales con un click
  - **Multimedia con drag & drop**: subida de fotos con reordenación arrastrando, numeración automática
  - Documentos adjuntos (PDF, Word, etc.)
  - Relaciones entre recursos (UNE 178503: "cerca de", "complementa", "incluye"...)
- Flujo editorial: Borrador → Revisión → Publicado → Archivado
- **Webhook automático** al publicar: notifica sistemas externos del cambio de estado

**Secciones del CMS (12 en total):**
- **Dashboard**: panel de control con KPIs e indicadores UNE
- **Recursos**: CRUD completo de recursos turísticos
- **Categorías**: gestión jerárquica (qué ver, qué hacer, dónde comer, dónde dormir, agenda, información)
- **Productos turísticos**: paquetes que agrupan varios recursos (ej: Ruta del Albariño)
- **Zonas geográficas** *(NUEVO)*: gestión de zonas dentro de cada municipio, con filtro por municipio
- **Páginas editoriales**: contenido libre tipo "Sobre nosotros", "Información práctica"
- **Navegación**: gestión de menús (cabecera, pie de página, lateral)
- **Exportaciones**: exportación a Plataforma Inteligente de Destinos (PID) y Data Lake
- **Actividad** *(NUEVO)*: registro completo de auditoría con filtros por entidad (UNE 178502 sec. 6.4)
- **Usuarios**: gestión de roles (administrador, editor, validador, técnico, analítica) con permisos diferenciados

**Aspectos visuales del CMS:**
- Tipografía Source Sans 3 (Google Fonts) — aspecto institucional
- Barra lateral con gradiente azul O Salnés y efectos hover animados
- Favicon con logo de la Mancomunidade
- Skeleton loading (animaciones de carga profesionales)
- Diseño responsive (adaptable a tablet)

### 2.2 ARIA — Asistente de Inteligencia Artificial *(NUEVO)*

**ARIA** (A Ría + Inteligencia Artificial) es el asistente IA integrado en el CMS, potenciado por **Google Gemini 2.5 Flash**.

**Funcionalidades:**
- **Chatbot flotante** accesible desde cualquier página del CMS (botón ✦ en la esquina inferior derecha)
- **Contextual**: las sugerencias cambian según la página donde estés:
  - En el Dashboard: "¿Cómo puedo mejorar la calidad de los datos?"
  - Editando un recurso: "Mejora la descripción de este recurso"
  - Creando uno nuevo: "Ayúdame a rellenar los datos de un hotel"
- **Genera contenido turístico**: descripciones atractivas y profesionales para playas, restaurantes, monumentos...
- **Traduce** entre español, gallego, inglés, francés y portugués
- **Optimiza SEO**: sugiere títulos (<60 caracteres) y descripciones (<160 caracteres) optimizados
- **Audita calidad**: analiza qué información le falta a un recurso
- **Conoce O Salnés**: entrenado con contexto específico de la comarca, sus municipios, gastronomía, patrimonio y estándares UNE

**Tecnología:** Google Gemini 2.5 Flash vía API, ejecutado en Supabase Edge Functions.

### 2.3 Web Pública Turística

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
- **Mapa interactivo**: mapa Leaflet con marcadores codificados por color según tipología, con leyenda
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

**Accesibilidad:**
- Skip links para navegación con teclado
- Etiquetas ARIA en todos los elementos interactivos
- Objetivos táctiles mínimos de 44x44px
- Soporte de movimiento reducido

**SEO:**
- Meta tags dinámicos (título, descripción, Open Graph, Twitter Cards)
- Sitemap XML dinámico
- robots.txt
- URLs canónicas por idioma
- Alternates hreflang para los 5 idiomas

### 2.4 API de Datos Abiertos

Capa de servicios que conecta el CMS con la Web y permite la interoperabilidad con sistemas externos.

**API pública (sin autenticación) — 15 endpoints:**
- Listado de recursos turísticos con filtros (tipo, municipio, idioma, paginación, **búsqueda por nombre**)
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

**API administrativa (con autenticación JWT) — 50+ endpoints:**
- CRUD completo: recursos, categorías, productos, páginas, navegación, usuarios, **zonas**
- Subida y gestión de multimedia con **reordenación**
- Dashboard con estadísticas e **indicadores UNE 178502**
- **Registro de auditoría** paginado con filtros
- Exportaciones PID / Data Lake
- **Webhook** de notificación en cambios de estado

**API GraphQL** (compatible PID SEGITTUR):
- Queries por tipo: placesByFilter, hotelsByFilter, beachesByFilter, restaurantsByFilter, eventsByFilter

### 2.5 Traducción Automática con IA

Sistema de traducción integrado en el CMS, **potenciado por Google Gemini**.

- Botones "Traducir a GL/EN/FR/PT" en el formulario de recursos
- **Traducción real con inteligencia artificial** — no es traducción automática genérica, sino contextualizada para turismo gallego
- Traducción desde castellano con un click
- Auto-detección: usa Gemini si la API key está configurada, fallback a mock
- Cola de trabajos asíncrona para traducción masiva en batch
- Soporte para 3 proveedores adicionales: LibreTranslate, DeepL, mock

### 2.6 Códigos QR para Recursos *(NUEVO)*

Sistema de generación de códigos QR integrado en el CMS.

- **Botón "QR"** en cada recurso de la tabla de recursos
- Código QR en color azul O Salnés (marca) en vez de negro genérico
- **Descargar como PNG** para usar en materiales impresos
- **Imprimir** con diseño de marca: nombre del recurso, "Destino Turístico Intelixente", URL, logo de la Mancomunidade
- El turista escanea el QR con su móvil y accede directamente a la ficha del recurso en la web pública
- **Aplicación DTI**: conecta el mundo físico (playa, restaurante, mirador) con el mundo digital

---

## 3. Cumplimiento normativo

### 3.1 UNE 178503 — Semántica aplicada a DTI

| Requisito | Estado | Detalle |
|-----------|--------|---------|
| Vocabulario schema.org | ✅ Cumplido | Todos los recursos usan clases schema.org |
| 77 tipologías turísticas | ✅ Cumplido | Catálogo completo (sec. 7.5) |
| **Tipologías múltiples por recurso** | ✅ Cumplido | Campo `rdf_types[]` + multi-select en CMS |
| 36 tipos de turista | ✅ Cumplido | Clasificación por viajero, actividad, motivación, producto (sec. 7.6) |
| 24 tipos de cocina | ✅ Cumplido | Gastronomía especializada (sec. 7.7) |
| URIs únicas | ✅ Cumplido | Formato `osalnes:recurso:{slug}` |
| Geolocalización | ✅ Cumplido | PostGIS con coordenadas GPS |
| **Zonas geográficas** | ✅ Cumplido | Gestión de zonas por municipio |
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
| **Trazabilidad de cambios** | ✅ Implementado | **Página dedicada de auditoría con filtros** |
| **Alertas de calidad** | ✅ Implementado | Alertas automáticas en Dashboard |
| Calidad del dato | ✅ Implementado | Dashboard con métricas |

### 3.3 Interoperabilidad PID SEGITTUR

| Requisito | Estado |
|-----------|--------|
| API GraphQL compatible | ✅ Desplegada |
| Formato JSON-LD schema.org | ✅ Endpoint disponible |
| Exportación a Data Lake | ✅ Módulo implementado |
| **Webhook de notificación** | ✅ Implementado |
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
         │  /api            ← público    │
         │  /admin          ← autenticado│
         │  /assistant      ← IA web     │
         │  /cms-assistant  ← ARIA (IA)  │
         │  /auto-translate ← Gemini     │
         ├───────────────────────────────┤
         │  Supabase                     │
         │  - PostgreSQL + PostGIS       │
         │  - Auth (JWT)                 │
         │  - Storage (multimedia)       │
         ├───────────────────────────────┤
         │  Google Gemini 2.5 Flash      │
         │  - ARIA (asistente CMS)       │
         │  - Traducción automática      │
         └───────────────────────────────┘
```

**Decisiones tecnológicas clave:**
- **Cloudflare Pages**: hosting global con CDN, sin coste de servidor, deploy automático desde GitHub
- **Supabase**: PostgreSQL gestionado con autenticación, almacenamiento de ficheros y edge functions incluidos
- **Next.js con Edge Runtime**: renderizado en el servidor para SEO óptimo, ejecutado en la red edge de Cloudflare
- **Google Gemini 2.5 Flash**: inteligencia artificial para el asistente ARIA y las traducciones automáticas
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
| Parador de Cambados | Hotel ★★★★ | Cambados |
| Hotel Spa Nanín Playa | Hotel ★★★★ | Sanxenxo |
| Camping Paisaxe II | Camping ★★ | O Grove |
| Restaurante Yayo Daporta | Restaurante ★★★★★ | Cambados |
| Restaurante D'Berto | Restaurante ★★★ | O Grove |
| Marisquería Pepe Vieira | Restaurante ★★★★★ | Ribadumia |
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
3. Mostrar el **Dashboard**: KPIs, indicadores UNE 178502 con gráficos circulares, alertas
4. Ir a **Recursos** → Mostrar los 15 recursos con badges de color
5. Click en **QR** de "Playa de A Lanzada" → Mostrar código QR con diseño de marca
6. Crear un nuevo recurso: **Bodega Martín Códax**
   - Tipología primaria: Winery
   - Tipologías secundarias: TouristAttraction (multi-select)
   - Municipio: Cambados
   - Zona: seleccionar zona geográfica
   - Coordenadas: 42.5092, -8.8156
   - Descripción en castellano: "Bodega cooperativa emblema del vino Albariño de las Rías Baixas"
   - Click en **"Traducir a GL"** → aparece la traducción real en gallego (Gemini)
7. Guardar → Cambiar estado a "Publicado"
8. Abrir **ARIA** (botón ✦) → "Escribe una descripción turística de esta bodega" → IA genera contenido

### Acto 2: Web — "Así lo ve el turista" (5 min)

1. Abrir `https://osalnes.pages.dev` → Página de inicio multilingüe
2. Navegar por **Qué ver** → Playas, monumentos
3. Abrir detalle de **Playa de A Lanzada** → Contacto, horarios, mapa
4. Ir al **Mapa interactivo** → Marcadores de colores por toda la comarca
5. Usar el **Buscador** → Buscar "Albariño"
6. Cambiar idioma a **Français** → Todo el contenido cambia

### Acto 3: Diferenciadores técnicos (3 min)

1. Mostrar **ARIA** en el CMS → Hacer una pregunta sobre turismo en O Salnés
2. Mostrar la **traducción con IA** → Traducir a gallego, inglés, francés con un click
3. Mostrar los **códigos QR** → Imprimir QR de un recurso
4. Mostrar los **indicadores UNE 178502** → Gráficos de madurez DTI
5. Mostrar la **página de Actividad** → Registro de auditoría con trazabilidad
6. Abrir `https://oduglbxjcmmdexwplzvw.supabase.co/functions/v1/api/export/jsonld` → Datos abiertos
7. Mencionar compatibilidad **PID SEGITTUR** vía GraphQL

---

## 7. Lo que hemos implementado en esta sesión

### Funcionalidades nuevas implementadas hoy

| Funcionalidad | Descripción | Impacto |
|--------------|-------------|---------|
| **ARIA (Asistente IA)** | Chatbot con Gemini 2.5 Flash integrado en el CMS, contextual | Diferenciador de producto |
| **Traducción con IA** | Traducciones reales ES→GL/EN/FR/PT con Gemini | Productividad del editor |
| **Códigos QR** | Generación, descarga PNG e impresión con marca | Conecta físico-digital (DTI) |
| **Indicadores UNE 178502** | 6 gauges con nota A/B/C/D en Dashboard | Cumplimiento normativo |
| **Página de Zonas** | CRUD completo de zonas geográficas | Completitud del modelo |
| **Página de Auditoría** | Registro de actividad paginado con filtros | Trazabilidad UNE 178502 |
| **Selector de zona** | Dropdown de zona filtrado por municipio en recursos | Modelo de datos completo |
| **Drag & drop multimedia** | Reordenar fotos arrastrando | UX profesional |
| **Tipologías múltiples** | Multi-select de tipos secundarios por recurso | UNE 178503 completo |
| **Webhooks de estado** | Notificación automática al publicar/revisar | Interoperabilidad |
| **Búsqueda server-side** | Buscar recursos por nombre desde el servidor | Funcionalidad básica |

### Bugs corregidos

| Bug | Impacto |
|-----|---------|
| Tipo `DashboardStats` sin campo `une178502` | Dashboard UNE roto |
| Mapeo traducción GL→PT incorrecto | Traducciones gallegas en portugués |
| Búsqueda solo client-side | No encontraba recursos fuera de la página actual |
| FK joins rotos en API (tipologia:rdf_type) | Errores en listado de recursos |

### Mejoras de arquitectura

| Mejora | Descripción |
|--------|-------------|
| Migraciones DOWN | Rollback posible para migraciones 005-008 |
| Index traduccion(campo) | Queries de traducción más rápidas |
| CHECK constraint export_job | Integridad de datos en exportaciones |
| Documentación naming convention | snake_case (input) vs camelCase (output) |

---

## 8. Próximos pasos (Entregable 2)

Funcionalidades planificadas para la siguiente fase:

| Funcionalidad | Prioridad | Descripción |
|--------------|-----------|-------------|
| PWA offline | Alta | Service worker para consulta sin internet (turistas sin cobertura) |
| Horarios estructurados | Alta | Editor visual de horarios tipo Google Maps |
| Campos de fecha para eventos | Alta | Fecha inicio/fin en recursos tipo evento |
| Panel de analytics de ARIA | Media | Estadísticas de conversaciones y preguntas frecuentes |
| Productos con recursos asociados | Media | Vincular recursos a productos turísticos |
| Modo alto contraste (accesibilidad) | Media | Toggle WCAG 2.1 AA en el CMS |
| Notificaciones push | Baja | Alertas a editores cuando hay contenido pendiente |
| App móvil | Baja | PWA para consulta offline del catálogo turístico |

---

## 9. Métricas del proyecto

| Métrica | Valor |
|---------|-------|
| Líneas de código | ~18.000 |
| Ficheros fuente | ~90 |
| Endpoints API | 65+ (público + admin) |
| Páginas CMS | 12 secciones |
| Páginas web | 12 rutas × 5 idiomas = 60+ páginas |
| Recursos demo | 15 recursos reales |
| Municipios | 9 configurados |
| Tipologías | 77 (catálogo UNE 178503 completo) |
| Idiomas | 5 (ES, GL, EN, FR, PT) |
| Edge Functions | 6 desplegadas |
| Modelos IA | Gemini 2.5 Flash (Google) |
| Migraciones BD | 9 (con rollback para 005-008) |
| Tiempo de carga web | <2s (Edge Runtime global) |

---

## 10. Tecnologías utilizadas

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend Web | Next.js 14, React 18, TypeScript | SEO, SSR, multilingüe |
| Frontend CMS | Vite 6, React 18, TypeScript | SPA rápida para administración |
| API | Supabase Edge Functions (Deno) | Sin servidor, escalable, bajo coste |
| Base de datos | PostgreSQL + PostGIS (Supabase) | Geoespacial, relacional, robusto |
| Autenticación | Supabase Auth (JWT) | Estándar, seguro, 5 roles |
| Almacenamiento | Supabase Storage | Fotos, documentos, CDN incluido |
| Hosting | Cloudflare Pages | CDN global, deploy automático, gratuito |
| IA Asistente | Google Gemini 2.5 Flash | ARIA: asistente CMS contextual |
| IA Traducción | Google Gemini 2.5 Flash | Traducciones reales ES→GL/EN/FR/PT |
| Mapas | Leaflet + OpenStreetMap | Open source, sin coste de licencia |
| QR Codes | qrcode (npm) | Generación client-side |
| Tipografía | Source Sans 3 (Google Fonts) | Aspecto institucional |
| Estándares | UNE 178502, UNE 178503, schema.org | Cumplimiento normativo DTI |

---

*Documento preparado para la sesión de control E1 — Marzo 2026*
*Mancomunidad de O Salnés · Financiado por la Unión Europea — NextGenerationEU (PRTR, Componente 14)*
