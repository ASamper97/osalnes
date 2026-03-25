# ENTREGABLE 1 — Documento de Analisis, Arquitectura y Planificacion

**Proyecto**: Plataforma Digital Turistica Inteligente — Mancomunidad de O Salnes
**Expediente**: Desarrollo CMS + Web DTI O Salnes
**Version**: 1.0
**Fecha**: 25 de marzo de 2026
**Clasificacion**: Entregable contractual (Hito 1 — 30%)

---

## Indice

1. [Introduccion y objeto](#1-introduccion-y-objeto)
2. [Analisis de requisitos](#2-analisis-de-requisitos)
3. [Arquitectura del sistema](#3-arquitectura-del-sistema)
4. [Modelo de datos UNE 178503](#4-modelo-de-datos-une-178503)
5. [Esquema de interoperabilidad PID](#5-esquema-de-interoperabilidad-pid)
6. [Cumplimiento normativo](#6-cumplimiento-normativo)
7. [Planificacion detallada](#7-planificacion-detallada)
8. [Gestion de riesgos](#8-gestion-de-riesgos)
9. [Anexos](#9-anexos)

---

## 1. Introduccion y objeto

### 1.1 Proposito del documento

El presente documento constituye el **Entregable 1** del contrato de desarrollo de la Plataforma Digital Turistica Inteligente para la Mancomunidad de O Salnes. Recoge el analisis funcional, la arquitectura tecnica, el modelo de datos alineado con la norma UNE 178503, el esquema de interoperabilidad con la Plataforma Inteligente de Destinos (PID) de SEGITTUR y la planificacion detallada del proyecto.

### 1.2 Alcance del proyecto

El proyecto comprende el diseno, desarrollo y despliegue de:

- **CMS (Sistema de Gestion de Contenidos)**: aplicacion web para la creacion, edicion, validacion y publicacion de recursos turisticos estructurados.
- **Portal web publico**: sitio multilingue (ES, GL, EN, FR, PT) con mapa interactivo, buscador, fichas de recurso y contenido editorial.
- **API REST publica**: endpoints para consumo del portal, aplicaciones de terceros y exportacion al Data Lake / PID.
- **Integracion PID**: exportacion automatizada de datos al sistema de Plataformas Inteligentes de Destinos de SEGITTUR.

### 1.3 Exclusiones confirmadas

Quedan fuera del alcance del presente contrato:

- Aplicacion movil nativa (prevista como evolucion futura)
- Modulos de gamificacion y fidelizacion
- CRM avanzado o comercio electronico
- Integraciones con totems, sensores IoT o apps de terceros no especificadas

### 1.4 Municipios integrados

La plataforma da servicio a los **8 municipios** de la Mancomunidad de O Salnes:

| Municipio | Codigo INE |
|---|---|
| Cambados | 36005 |
| A Illa de Arousa | 36024 |
| Meano | 36028 |
| O Grove | 36022 |
| Ribadumia | 36045 |
| Sanxenxo | 36051 |
| Vilagarcia de Arousa | 36057 |
| Vilanova de Arousa | 36058 |

---

## 2. Analisis de requisitos

### 2.1 Actores del sistema

| Actor | Rol | Permisos |
|---|---|---|
| **Administrador** | Gestion completa | CRUD total, gestion de usuarios, configuracion |
| **Editor** | Creacion de contenido | Crear y editar recursos, subir multimedia |
| **Validador** | Control de calidad | Revisar y publicar/rechazar recursos |
| **Tecnico** | Mantenimiento | Acceso a logs, exportaciones, configuracion tecnica |
| **Analitica** | Consulta | Acceso de solo lectura a datos y metricas |
| **Visitante** | Usuario publico | Navegar web, buscar, consultar mapa y fichas |

### 2.2 Requisitos funcionales

#### RF-01: Gestion de recursos turisticos (CMS)
- Crear, editar, eliminar recursos turisticos con campos estructurados segun UNE 178503
- Flujo editorial: borrador -> revision -> publicado -> archivado
- Geolocalizacion con coordenadas (latitud/longitud) y direccion postal
- Clasificacion por tipologia (UNE 178503 seccion 7.5) y categorias jerarquicas
- Campos multilingues (ES, GL, EN, FR, PT) con gestion independiente por idioma
- Gestion de multimedia (imagenes, video, documentos descargables)
- Campo `visible_en_mapa` para control granular de la visibilidad geografica

#### RF-02: Portal web publico
- Diseno responsive y mobile-first
- Rutas internacionalizadas (`/es/`, `/gl/`, `/en/`, `/fr/`, `/pt/`)
- Pagina de inicio con recursos destacados
- Secciones tematicas: Que ver, Que hacer, Experiencias, Agenda, Directorio, Noticias, Info
- Ficha detallada de recurso con SEO (meta tags, schema.org JSON-LD)
- Buscador de texto completo con filtros por tipologia y municipio

#### RF-03: Mapa interactivo
- Mapa basado en Leaflet con tiles de OpenStreetMap
- Carga dinamica de marcadores por bounding box (hasta 500 por vista)
- **Iconos diferenciados por grupo de tipologia** (6 colores: alojamiento, restauracion, atracciones, eventos, transporte, servicios)
- Filtros por tipologia y municipio
- Popups con nombre, tipo, direccion y enlace a la ficha
- Leyenda visual de tipologias
- Respeta `visible_en_mapa` y `estado_editorial = publicado`

#### RF-04: API REST publica
- Endpoints RESTful para recursos, tipologias, categorias, municipios, zonas, paginas, navegacion, eventos
- Busqueda por texto (ILIKE, con migracion prevista a Meilisearch)
- Endpoint especifico para mapa con filtro por bounding box
- Respuestas JSON con soporte multilingue

#### RF-05: Gestion editorial
- Roles con permisos diferenciados
- Transiciones de estado controladas (solo las permitidas)
- Log de cambios (auditoria) con usuario, accion, timestamp y detalle del cambio

#### RF-06: Navegacion configurable
- Menus gestionables desde el CMS
- Estructura jerarquica (parent/child)
- Etiquetas multilingues

#### RF-07: Paginas de contenido libre
- Editor de paginas con plantillas
- Campos multilingues (titulo, cuerpo, SEO)
- Flujo editorial independiente

### 2.3 Requisitos no funcionales

| ID | Requisito | Especificacion |
|---|---|---|
| RNF-01 | Accesibilidad | WCAG 2.1 nivel AA |
| RNF-02 | Rendimiento | Tiempo de carga < 3s (LCP), ISR con revalidacion 60s |
| RNF-03 | Disponibilidad | 99.9% (garantizado por infraestructura Supabase + Cloudflare) |
| RNF-04 | Seguridad | HTTPS obligatorio, JWT, CORS, Helmet, OWASP Top 10 |
| RNF-05 | Escalabilidad | Arquitectura serverless, autoescalado horizontal |
| RNF-06 | Multilingue | 5 idiomas (ES, GL, EN, FR, PT) en portal y CMS |
| RNF-07 | SEO | SSR, meta tags dinamicos, JSON-LD schema.org |
| RNF-08 | Interoperabilidad | UNE 178503, schema.org, JSON-LD, API REST, PID SEGITTUR |
| RNF-09 | Trazabilidad | Log completo de cambios editoriales |
| RNF-10 | Backup | Backups automaticos diarios (Supabase managed) |

---

## 3. Arquitectura del sistema

### 3.1 Vision general

La plataforma sigue una **arquitectura de microservicios desacoplada** organizada como monorepo con tres paquetes independientes que se despliegan de forma autonoma:

```
                     Internet
                        |
           +-----------+-----------+
           |                       |
   +-------+--------+    +--------+-------+
   | Portal Web     |    | CMS            |
   | (Next.js 15)   |    | (Vite+React)   |
   | SSR + ISR      |    | SPA            |
   | Cloudflare     |    | Cloudflare     |
   | Pages          |    | Pages          |
   +-------+--------+    +--------+-------+
           |                       |
           +----------++-----------+
                      ||
                      || HTTPS
                      ||
           +----------++----------+
           | Supabase Edge Fns    |
           | (Deno runtime)       |
           |                      |
           | /functions/v1/api    | <-- lectura publica
           | /functions/v1/admin  | <-- CRUD autenticado
           +----------+-----------+
                      |
           +----------+-----------+
           | Supabase Platform    |
           |                      |
           | - PostgreSQL 15      |
           |   + PostGIS          |
           | - Auth (JWT)         |
           | - Storage (S3)       |
           | - Realtime           |
           +----------------------+
                      |
           +----------+-----------+
           | Exportacion PID      |
           | (Edge Function       |
           |  programada)         |
           +----------------------+
```

### 3.2 Stack tecnologico

| Capa | Tecnologia | Version | Justificacion |
|---|---|---|---|
| **Frontend Web** | Next.js (App Router) | 15.x | SSR + ISR para SEO, routing i18n nativo |
| **Frontend CMS** | Vite + React | 6.x / 18.x | SPA ligera, build rapido, sin complejidad SSR |
| **API Runtime** | Supabase Edge Functions (Deno) | — | Serverless, cold-start optimizado, autoescalado |
| **API Dev** | Express.js | 4.x | Desarrollo local rapido con hot-reload |
| **Base de datos** | PostgreSQL + PostGIS | 15+ | Geoespacial nativo, indices GiST, JSON/JSONB |
| **Autenticacion** | Supabase Auth (JWT) | — | Gestion de usuarios, tokens, refresh automatico |
| **Almacenamiento** | Supabase Storage | — | Imagenes, documentos, CDN integrado |
| **Mapa** | Leaflet + react-leaflet | 1.9 / 5.0 | Ligero, sin vendor lock-in, renderizado cliente |
| **Tiles** | OpenStreetMap | — | Gratuito, sin limitaciones de uso |
| **Hosting Web/CMS** | Cloudflare Pages | — | CDN global, auto-deploy, HTTPS, headers |
| **Monorepo** | npm workspaces | — | Tipos compartidos, versionado unificado |
| **Lenguaje** | TypeScript | 5.7 | Tipado estatico, interfaces compartidas |
| **Validacion** | Zod | — | Validacion de schemas en runtime |

### 3.3 Arquitectura de paquetes (monorepo)

```
osalnes-dti/
|-- packages/
|   |-- shared/     # Tipos TypeScript e interfaces compartidas
|   |               # Constantes: tipologias UNE 178503, municipios
|   |
|   |-- api/        # Servidor Express (desarrollo local)
|   |               # Rutas publicas y admin
|   |               # Servicios: traducciones, recursos, auth
|   |
|   |-- web/        # Portal publico Next.js
|   |               # App Router con rutas [lang]
|   |               # Componentes: MapView, Header, Footer
|   |               # i18n: 5 idiomas con diccionarios JSON
|   |
|   |-- cms/        # Panel de administracion Vite+React
|                   # Paginas: Resources, Categories, Navigation,
|                   #   Pages, Assets, Users
|
|-- database/
|   |-- migrations/ # Schema SQL versionado (001-004)
|   |-- seeds/      # Datos iniciales: municipios, tipologias, categorias
|
|-- supabase/
    |-- functions/
        |-- _shared/ # Helpers comunes (CORS, auth, router, traducciones)
        |-- api/     # Edge Function publica (14 endpoints)
        |-- admin/   # Edge Function protegida (CRUD completo)
```

### 3.4 Flujo de datos

#### Lectura (visitante consulta el mapa)

```
1. Navegador carga /es/mapa (Next.js SSR)
2. Componente MapView se monta (client-side)
3. Leaflet calcula bounding box visible
4. Fetch GET /api/v1/map/resources?bounds=SW,NE&type=Hotel
5. Edge Function consulta PostgreSQL:
   - Filtra: estado_editorial=publicado, visible_en_mapa=true
   - Filtra: coordenadas dentro del bounding box
   - Join con tipologia para obtener grupo
   - Batch-query traducciones (1 query, no N+1)
6. Respuesta JSON con id, slug, name{}, rdfType, grupo, location{}
7. MapView renderiza marcadores SVG coloreados por grupo
8. Click en marcador -> popup con badge, nombre y enlace a ficha
```

#### Escritura (editor crea recurso)

```
1. Editor accede a cms.osalnes.gal (Vite SPA)
2. Login via Supabase Auth -> JWT
3. Rellena formulario de recurso con campos UNE 178503
4. POST /admin/resources con Authorization: Bearer <jwt>
5. Edge Function verifica JWT, extrae rol, valida permisos
6. INSERT en recurso_turistico (estado: borrador)
7. INSERT traducciones multilingues
8. INSERT relaciones recurso-categoria
9. INSERT en log_cambios (auditoria)
10. Recurso queda en borrador hasta validacion
```

#### Publicacion (validador aprueba)

```
1. Validador ve recursos en estado "revision"
2. PATCH /admin/resources/:id/status { status: "publicado" }
3. Edge Function verifica transicion permitida (revision -> publicado)
4. UPDATE estado_editorial, published_at
5. INSERT en log_cambios
6. Recurso visible en portal web (siguiente revalidacion ISR, ~60s)
```

### 3.5 Seguridad

| Capa | Mecanismo | Implementacion |
|---|---|---|
| Transporte | HTTPS/TLS | Cloudflare (automatico) + Supabase (automatico) |
| Autenticacion | JWT (RS256) | Supabase Auth con verificacion manual en Edge Functions |
| Autorizacion | RBAC | 5 roles: admin, editor, validador, tecnico, analitica |
| API | CORS | Origenes configurables por entorno |
| API | Rate limiting | Supabase platform (default) |
| Headers | Seguridad | Helmet.js (dev), `_headers` Cloudflare (prod) |
| Datos | Parametrizacion | Supabase client (prepared statements) |
| Auditoria | Log cambios | Tabla `log_cambios` con JSONB de detalle |
| Almacenamiento | Buckets privados | Supabase Storage con politicas RLS |

---

## 4. Modelo de datos UNE 178503

### 4.1 Alineacion con la norma

El modelo de datos sigue la estructura definida en la norma **UNE 178503:2023** "Destinos Turisticos Inteligentes. Semantica aplicada a turismo" en sus secciones:

- **Seccion 7.2**: Entidad central `TouristResource` -> tabla `recurso_turistico`
- **Seccion 7.3**: Localizacion (latitud, longitud, direccion) -> campos `latitude`, `longitude`, `address_*`, `geo` (PostGIS)
- **Seccion 7.4**: Contacto (telefono, email, web, redes) -> campos `telephone[]`, `email[]`, `url`, `same_as[]`
- **Seccion 7.5**: Tipologias -> tabla `tipologia` con `type_code` mapeado a schema.org
- **Seccion 7.6**: Tipos de turista -> campo `tourist_types[]`
- **Seccion 7.7**: Atributos especificos -> `rating_value`, `serves_cuisine[]`, `is_accessible_for_free`, `public_access`, `occupancy`, `opening_hours`
- **Seccion 7.8**: Datos extendidos -> campo `extras` (JSONB)
- **Seccion 8**: Multilingue -> tabla `traduccion` con soporte para ES, GL, EN, FR, PT

### 4.2 Esquema entidad-relacion

```
                                +------------------+
                                |    municipio      |
                                |------------------|
                                | id (PK, UUID)    |
                                | codigo_ine       |
                                | slug             |
                                | latitude         |
                                | longitude        |
                                | geo (PostGIS)    |
                                +--------+---------+
                                         |
                                         | 1:N
                                         |
+------------------+            +--------+---------+            +------------------+
|   tipologia      |            | recurso_turistico|            |    categoria      |
|------------------|    N:1     |------------------|    M:N     |------------------|
| id (PK, UUID)   +<-----------+ id (PK, UUID)    +----------->| id (PK, UUID)   |
| type_code        |            | uri (UNIQUE)     |            | slug             |
| schema_org_type  |            | rdf_type (FK)    |  recurso_  | parent_id (FK)   |
| grupo            |            | rdf_types[]      |  categoria | orden            |
| activo           |            | slug (UNIQUE)    |            +------------------+
+------------------+            | municipio_id (FK)|
                                | zona_id (FK)     |            +------------------+
                                | latitude         |    M:N     | producto_        |
                                | longitude        +----------->| turistico        |
                                | geo (PostGIS)    |  recurso_  |------------------|
                                | address_street   |  producto  | id (PK, UUID)   |
                                | address_postal   |            | slug             |
                                | telephone[]      |            +------------------+
                                | email[]          |
                                | url              |
                                | same_as[]        |            +------------------+
                                | tourist_types[]  |    1:N     | asset_multimedia |
                                | rating_value     +----------->|------------------|
                                | serves_cuisine[] |            | id (PK, UUID)   |
                                | is_accessible_   |            | entidad_tipo     |
                                |   for_free       |            | entidad_id (FK)  |
                                | public_access    |            | tipo             |
                                | occupancy        |            | url              |
                                | opening_hours    |            | storage_path     |
                                | extras (JSONB)   |            +------------------+
                                | estado_editorial |
                                | visible_en_mapa  |            +------------------+
                                | published_at     |    1:N     | traduccion       |
                                | created_at       +----------->|------------------|
                                | updated_at       |            | entidad_tipo     |
                                | created_by (FK)  |            | entidad_id       |
                                | updated_by (FK)  |            | campo            |
                                +------------------+            | idioma           |
                                         |                      | valor            |
                                         | 1:N                  +------------------+
                                         |
                                +--------+---------+
                                |   log_cambios    |
                                |------------------|
                                | id (PK, UUID)    |
                                | entidad_tipo     |
                                | entidad_id       |
                                | accion           |
                                | usuario_id (FK)  |
                                | cambios (JSONB)  |
                                | created_at       |
                                +------------------+
```

### 4.3 Tabla principal: `recurso_turistico`

```sql
CREATE TABLE recurso_turistico (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uri                     VARCHAR(500) UNIQUE NOT NULL,     -- URI semantica
    rdf_type                VARCHAR(100) NOT NULL,            -- Tipologia UNE 178503
    rdf_types               VARCHAR(100)[] DEFAULT '{}',      -- Tipologias secundarias
    slug                    VARCHAR(300) UNIQUE NOT NULL,     -- Identificador URL-friendly

    -- Ubicacion (UNE 178503 sec. 7.3)
    municipio_id            UUID REFERENCES municipio(id),
    zona_id                 UUID REFERENCES zona(id),
    latitude                NUMERIC(10, 7),
    longitude               NUMERIC(10, 7),
    geo                     GEOMETRY(Point, 4326),            -- PostGIS
    address_street          VARCHAR(500),
    address_postal          VARCHAR(10),

    -- Contacto (UNE 178503 sec. 7.4)
    telephone               VARCHAR(20)[] DEFAULT '{}',
    email                   VARCHAR(255)[] DEFAULT '{}',
    url                     VARCHAR(500),
    same_as                 VARCHAR(500)[] DEFAULT '{}',      -- Redes sociales

    -- Clasificacion turistica (UNE 178503 sec. 7.6)
    tourist_types           VARCHAR(100)[] DEFAULT '{}',

    -- Atributos especificos (UNE 178503 sec. 7.7)
    rating_value            INTEGER CHECK (rating_value BETWEEN 1 AND 6),
    serves_cuisine          VARCHAR(100)[] DEFAULT '{}',
    is_accessible_for_free  BOOLEAN,
    public_access           BOOLEAN,
    occupancy               INTEGER,
    opening_hours           VARCHAR(500),

    -- Datos extendidos (UNE 178503 sec. 7.8)
    extras                  JSONB DEFAULT '{}',

    -- Control editorial
    estado_editorial        VARCHAR(20) DEFAULT 'borrador'
        CHECK (estado_editorial IN ('borrador','revision','publicado','archivado')),
    visible_en_mapa         BOOLEAN DEFAULT true,
    published_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    created_by              UUID REFERENCES usuario(id),
    updated_by              UUID REFERENCES usuario(id)
);
```

### 4.4 Tipologias (UNE 178503 seccion 7.5)

El catalogo de tipologias se organiza en **6 grupos** con **67 tipos** alineados con schema.org:

| Grupo | Tipos | Ejemplos schema.org |
|---|---|---|
| **alojamiento** | Hotel, RuralHouse, BedAndBreakfast, Campground, Apartment, Hostel, ApartHotel, GuestHouse, RuralHotel, LodgingBusiness | schema:Hotel, schema:BedAndBreakfast |
| **restauracion** | Restaurant, BarOrPub, CafeOrCoffeeShop, Winery, Brewery, IceCreamShop | schema:Restaurant, schema:BarOrPub |
| **recurso** | TouristAttraction, Beach, Museum, Park, NaturePark, ViewPoint, Monument, Trail, PlaceOfWorship, Cave, Waterfall, GolfCourse, YachtingPort, ArtGallery, Library, CultureCenter... (30+ tipos) | schema:TouristAttraction, schema:Beach, schema:Museum |
| **evento** | Event, Festival, TraditionalFestival, FoodEvent, MusicEvent, SportsEvent, ExhibitionEvent, BusinessEvent, Fair | schema:Event, schema:Festival |
| **transporte** | BusStation, BusStop, Port, TaxiStand, ParkingFacility, TrainStation | schema:BusStation |
| **servicio** | TouristInformationCenter, TravelAgency, GasStation, FinancialService, Hospital, Pharmacy, PoliceStation | schema:TouristInformationCenter |

### 4.5 Tipos de turista (UNE 178503 seccion 7.6)

Clasificacion secundaria por tipo de viajero, actividad, motivacion y producto:

| Categoria | Valores |
|---|---|
| **Viajero** | Family, LGTBI, Backpacking, Business, Romantic, Senior |
| **Actividad** | Adventure, Wellness, Cycling, WaterSports, Skiing, Hiking, Fishing, Diving, Surfing, Kayaking |
| **Motivacion** | Cultural, Ecotourism, Heritage, Religious, Rural, Birdwatching, Astronomical |
| **Producto** | FoodTourism, WineTourism, BeerTourism, OliveOilTourism |

### 4.6 Sistema multilingue

El multilingue se implementa mediante una **tabla de traducciones normalizada** que permite anadir idiomas sin modificar el esquema:

```sql
CREATE TABLE traduccion (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_tipo VARCHAR(100) NOT NULL,   -- 'recurso_turistico', 'tipologia', etc.
    entidad_id   UUID NOT NULL,
    campo        VARCHAR(100) NOT NULL,   -- 'name', 'description', 'seo_title'...
    idioma       VARCHAR(5) NOT NULL,     -- 'es', 'gl', 'en', 'fr', 'pt'
    valor        TEXT NOT NULL,
    UNIQUE(entidad_tipo, entidad_id, campo, idioma)
);
```

**Idiomas soportados**: Espanol (es), Gallego (gl), Ingles (en), Frances (fr), Portugues (pt)

**Entidades traducibles**: recurso_turistico, tipologia, categoria, municipio, zona, pagina, navegacion

### 4.7 Indices de rendimiento

```sql
CREATE INDEX idx_recurso_tipo       ON recurso_turistico(rdf_type);
CREATE INDEX idx_recurso_municipio  ON recurso_turistico(municipio_id);
CREATE INDEX idx_recurso_zona       ON recurso_turistico(zona_id);
CREATE INDEX idx_recurso_estado     ON recurso_turistico(estado_editorial);
CREATE INDEX idx_recurso_geo        ON recurso_turistico USING GIST(geo);
CREATE INDEX idx_recurso_mapa       ON recurso_turistico(visible_en_mapa)
                                    WHERE estado_editorial = 'publicado';
CREATE INDEX idx_traduccion_lookup  ON traduccion(entidad_tipo, entidad_id, campo, idioma);
CREATE INDEX idx_log_entidad        ON log_cambios(entidad_tipo, entidad_id);
```

---

## 5. Esquema de interoperabilidad PID

### 5.1 Plataforma Inteligente de Destinos (PID)

La integracion con la PID de SEGITTUR permite publicar los datos turisticos de O Salnes en el ecosistema nacional de Destinos Turisticos Inteligentes, cumpliendo con los requisitos de interoperabilidad establecidos en la norma UNE 178501.

### 5.2 Arquitectura de integracion

```
+------------------+       +------------------+       +------------------+
| CMS O Salnes     |       | API O Salnes     |       | PID SEGITTUR     |
|                  | edita |                  | exporta|                  |
| Editor publica   +------>| /api/v1/export   +------>| GraphQL endpoint |
| recurso          |       | Edge Function    |       | pid.segittur.es  |
|                  |       | programada       |       |                  |
+------------------+       +--------+---------+       +------------------+
                                    |
                           +--------+---------+
                           | Data Lake        |
                           | (JSON-LD / CSV)  |
                           | export_job table |
                           +------------------+
```

### 5.3 Formato de exportacion

Los datos se exportan en formato **JSON-LD** siguiendo el vocabulario schema.org y la estructura UNE 178503:

```json
{
  "@context": "https://schema.org",
  "@type": "Hotel",
  "@id": "osalnes:recurso:hotel-cambados-example",
  "name": {
    "@language": "es",
    "@value": "Hotel Ejemplo Cambados"
  },
  "description": {
    "@language": "es",
    "@value": "Hotel con vistas a la ria de Arousa..."
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Rua do Principe, 10",
    "postalCode": "36630",
    "addressLocality": "Cambados",
    "addressRegion": "Pontevedra",
    "addressCountry": "ES"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 42.5145,
    "longitude": -8.8140
  },
  "telephone": "+34 986 520 000",
  "url": "https://turismo.osalnes.gal/es/recurso/hotel-cambados-example",
  "starRating": {
    "@type": "Rating",
    "ratingValue": 4
  },
  "touristType": ["Family", "Cultural"],
  "isAccessibleForFree": false,
  "publicAccess": true
}
```

### 5.4 Mecanismo de exportacion

| Aspecto | Especificacion |
|---|---|
| **Protocolo** | HTTPS (GraphQL mutation a PID, REST para Data Lake) |
| **Frecuencia** | Diaria (batch nocturno) + bajo demanda (manual desde CMS) |
| **Trigger** | Edge Function programada via CRON + boton en CMS |
| **Filtro** | Solo recursos con `estado_editorial = 'publicado'` |
| **Tracking** | Tabla `export_job` registra cada ejecucion: estado, registros ok/error, timestamp |
| **Reintentos** | 3 reintentos con backoff exponencial |
| **Identificador DTI** | `osalnes` (campo `PID_DTI_CODE`) |
| **Endpoint PID** | `https://pid.segittur.es/graphql` |

### 5.5 Tabla de control de exportaciones

```sql
CREATE TABLE export_job (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo          VARCHAR(50) NOT NULL,          -- 'pid', 'datalake', 'jsonld'
    estado        VARCHAR(20) DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','en_proceso','completado','error')),
    parametros    JSONB DEFAULT '{}',            -- Filtros aplicados
    resultado     JSONB DEFAULT '{}',            -- Detalles del resultado
    registros_ok  INTEGER DEFAULT 0,
    registros_err INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);
```

### 5.6 Normas de interoperabilidad aplicadas

| Norma | Aplicacion |
|---|---|
| **UNE 178503** | Modelo semantico de datos turisticos |
| **UNE 178501** | Sistema de gestion del DTI (gobernanza de datos) |
| **UNE 178502** | Indicadores y herramientas del DTI |
| **UNE 178511** | Accesibilidad universal en DTI |
| **UNE 178104** | Indicadores de sostenibilidad |
| **schema.org** | Vocabulario RDF para SEO y linked data |
| **JSON-LD** | Formato de serializacion para datos enlazados |
| **OpenAPI 3.0** | Especificacion de la API REST (previsto E3) |

---

## 6. Cumplimiento normativo

### 6.1 WCAG 2.1 AA

El portal web implementa los principios de accesibilidad:

| Principio | Implementacion |
|---|---|
| **Perceptible** | Textos alternativos en imagenes, contraste >= 4.5:1, tamano de fuente base 16px, landmarks ARIA |
| **Operable** | Navegacion por teclado, foco visible (outline 3px), skip-to-content, sin trampas de teclado |
| **Comprensible** | Idioma declarado en `<html lang>`, mensajes de error claros, navegacion consistente |
| **Robusto** | HTML5 semantico, roles ARIA en mapa (`role="application"`), compatibilidad con lectores de pantalla |

**Medidas especificas implementadas en el mapa**:
- `role="application"` en el contenedor del mapa
- `aria-label` descriptivos en filtros y leyenda
- `aria-hidden="true"` en elementos decorativos (dots de la leyenda)
- Texto alternativo equivalente al contenido visual

### 6.2 RGPD / Proteccion de datos

| Aspecto | Implementacion |
|---|---|
| Datos personales | Minimos: email y nombre de usuarios CMS (no visitantes) |
| Base legal | Consentimiento (usuarios CMS) / Interes publico (datos turisticos) |
| Derecho acceso | Exportable via API admin |
| Derecho supresion | DELETE en cascada (usuario + logs asociados) |
| Encriptacion | TLS en transito, encriptacion en reposo (Supabase managed) |
| Retencion | Logs de cambios sin TTL (configurable) |

### 6.3 Esquema Nacional de Seguridad (ENS)

El despliegue en proveedores con certificacion ISO 27001 (Cloudflare, Supabase/AWS) proporciona la base de cumplimiento. Se recomienda una auditoria formal para nivel medio ENS.

---

## 7. Planificacion detallada

### 7.1 Fases del proyecto

| Fase | Descripcion | Duracion | Estado |
|---|---|---|---|
| **F1** | Analisis y arquitectura | Semanas 1-2 | **COMPLETADA** |
| **F2** | Desarrollo core (CMS + Web + API) | Semanas 3-10 | **COMPLETADA** |
| **F3** | Mapa interactivo con iconos por tipologia | Semana 11 | **COMPLETADA** |
| **F4** | Integracion PID y exportacion JSON-LD | Semanas 12-13 | Pendiente |
| **F5** | Asistente IA basico (recomendaciones) | Semana 14 | Pendiente |
| **F6** | Auditoria WCAG + evidencias | Semana 15 | Pendiente |
| **F7** | Documentacion final (OpenAPI, manuales) | Semana 16 | Pendiente |
| **F8** | Testing, correccion y despliegue final | Semanas 17-18 | Pendiente |

### 7.2 Cronograma de hitos

```
Semana  1-2   [####] F1: Analisis y arquitectura (E1)
Semana  3-6   [####] F2a: Schema DB + API REST + Shared types
Semana  7-8   [####] F2b: CMS (CRUD recursos, usuarios, navegacion)
Semana  9-10  [####] F2c: Portal web (SSR, i18n, busqueda)
Semana 11     [####] F3: Mapa con iconos por tipologia + leyenda
Semana 12-13  [----] F4: Endpoint JSON-LD + integracion PID SEGITTUR
Semana 14     [----] F5: Asistente IA basico
Semana 15     [----] F6: Auditoria WCAG 2.1 AA
Semana 16     [----] F7: Documentacion (OpenAPI, manuales)
Semana 17-18  [----] F8: Testing final + despliegue produccion

[####] = Completado    [----] = Pendiente
```

### 7.3 Entregables contractuales

| Entregable | Contenido | Hito de pago | Estado |
|---|---|---|---|
| **E1** (30%) | Documento de analisis, arquitectura, modelo datos UNE 178503, esquema PID, planificacion | Aprobacion del presente documento | **Este documento** |
| **E2** (40%) | CMS + Web operativos, WCAG 2.1 AA, buscador, mapa con iconos, APIs funcionales | Demo funcional + acceso a entornos | En progreso |
| **E3** (30%) | Manuales tecnicos y funcionales, especificacion OpenAPI, plan de reversibilidad, formacion | Entrega documentacion final | Pendiente |

### 7.4 Equipo

| Rol | Responsabilidad |
|---|---|
| **Jefe de proyecto** | Planificacion, interlocucion con Mancomunidad, seguimiento de hitos |
| **Arquitecto software** | Diseno tecnico, decision stack, revision de codigo |
| **Desarrollador fullstack** | Implementacion API, Web, CMS |
| **Especialista UX/accesibilidad** | Diseno responsive, auditoria WCAG |
| **Especialista datos/PID** | Modelo UNE 178503, integracion SEGITTUR |

---

## 8. Gestion de riesgos

| ID | Riesgo | Probabilidad | Impacto | Mitigacion |
|---|---|---|---|---|
| R1 | Especificaciones PID cambian durante el desarrollo | Media | Alto | Abstraer la capa de exportacion; usar adapter pattern |
| R2 | Volumen de contenido inicial insuficiente para demo | Alta | Medio | Preparar seed de datos de ejemplo por municipio |
| R3 | Requisitos WCAG no cubiertos en componentes de terceros (Leaflet) | Media | Medio | Texto alternativo equivalente al mapa; pruebas con lectores de pantalla |
| R4 | Latencia en Edge Functions con muchas traducciones | Baja | Medio | Batch queries implementados; cache en CDN |
| R5 | Cambio de requisitos del cliente durante desarrollo | Media | Alto | Desarrollo iterativo con demos quincenales; scope congelado por fase |
| R6 | Indisponibilidad temporal de Supabase | Baja | Alto | ISR de Next.js sirve contenido cacheado; fallback en API |

---

## 9. Anexos

### Anexo A: Endpoints de la API REST

#### Endpoints publicos (`/api/v1/`)

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/resources` | Listar recursos con filtros (type, municipio, status, paginacion) |
| GET | `/resources/:id` | Detalle de recurso por ID |
| GET | `/resources/by-slug/:slug` | Detalle de recurso por slug |
| GET | `/typologies` | Catalogo de tipologias UNE 178503 |
| GET | `/categories` | Arbol de categorias |
| GET | `/categories/:slug` | Detalle de categoria |
| GET | `/municipalities` | Listado de municipios |
| GET | `/zones` | Listado de zonas (filtrable por municipio) |
| GET | `/pages/:slug` | Pagina de contenido libre |
| GET | `/navigation/:menuSlug` | Menu de navegacion |
| GET | `/events` | Listado de eventos |
| GET | `/map/resources` | Recursos para mapa (bounding box, tipo, municipio) |
| GET | `/search` | Busqueda de texto con filtros |

#### Endpoints administrativos (`/admin/`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| POST | `/resources` | Crear recurso | admin, editor |
| PUT | `/resources/:id` | Actualizar recurso | admin, editor |
| PATCH | `/resources/:id/status` | Cambiar estado editorial | admin, validador |
| DELETE | `/resources/:id` | Eliminar recurso | admin |
| POST | `/assets/upload` | Subir multimedia | admin, editor |
| DELETE | `/assets/:id` | Eliminar multimedia | admin |
| POST | `/documents/upload` | Subir documento | admin, editor |
| CRUD | `/categories/*` | Gestion de categorias | admin |
| CRUD | `/pages/*` | Gestion de paginas | admin, editor |
| CRUD | `/navigation/*` | Gestion de menus | admin |
| CRUD | `/users/*` | Gestion de usuarios | admin |

### Anexo B: Variables de entorno

| Variable | Ambito | Descripcion |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Web | URL base de la API publica |
| `NEXT_PUBLIC_SUPABASE_URL` | Web | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | Clave anonima Supabase |
| `VITE_API_URL` | CMS | URL de la API publica |
| `VITE_ADMIN_URL` | CMS | URL de la API admin |
| `VITE_SUPABASE_URL` | CMS | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | CMS | Clave anonima Supabase |
| `SUPABASE_URL` | API | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | API | Clave de servicio (admin) |
| `PID_DTI_CODE` | API | Identificador DTI para PID |
| `PID_ENDPOINT` | API | Endpoint GraphQL de SEGITTUR |
| `CORS_ORIGINS` | API | Origenes CORS permitidos |

### Anexo C: Transiciones de estado editorial

```
                    +----------+
                    | borrador |<---------+
                    +----+-----+          |
                         |                |
                   [enviar a              |
                    revision]        [devolver a
                         |            borrador]
                         v                |
                    +----------+          |
                    | revision +-----------+
                    +----+-----+
                         |
                  [aprobar/publicar]
                         |
                         v
                    +-----------+
             +----->| publicado |
             |      +-----+-----+
             |            |
        [republicar]  [archivar]
             |            |
             |            v
             |      +-----------+
             +------+ archivado |
                    +-----------+
```

### Anexo D: Colores de marcadores del mapa por grupo de tipologia

| Grupo | Color | Hex | Ejemplo |
|---|---|---|---|
| Alojamiento | Azul | `#2E86C1` | Hotel, Casa rural, Camping |
| Restauracion | Naranja | `#E67E22` | Restaurante, Bar, Cafeteria |
| Atracciones | Verde | `#27AE60` | Playa, Museo, Parque, Mirador |
| Eventos | Morado | `#8E44AD` | Festival, Concierto, Feria |
| Transporte | Gris | `#607D8B` | Estacion de bus, Puerto, Parking |
| Servicios | Rojo | `#E74C3C` | Oficina de turismo, Farmacia, Hospital |

---

**Fin del documento**

*Documento generado como parte del Entregable 1 del contrato de desarrollo de la Plataforma Digital Turistica Inteligente para la Mancomunidad de O Salnes.*
