-- =============================================================================
-- DTI Salnes - Migracion 001: Schema inicial
-- Modelo de datos alineado con UNE 178503
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =============================================================================
-- USUARIOS Y ROLES
-- =============================================================================

CREATE TABLE usuario (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    nombre      VARCHAR(200) NOT NULL,
    rol         VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'editor', 'validador', 'tecnico', 'analitica')),
    password_hash VARCHAR(255),
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MUNICIPIOS Y ZONAS
-- =============================================================================

CREATE TABLE municipio (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_ine  VARCHAR(10) UNIQUE NOT NULL,
    slug        VARCHAR(200) UNIQUE NOT NULL,
    latitude    NUMERIC(10, 7),
    longitude   NUMERIC(10, 7),
    geo         GEOMETRY(Point, 4326),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE zona (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug          VARCHAR(200) UNIQUE NOT NULL,
    municipio_id  UUID REFERENCES municipio(id),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TIPOLOGIAS (catálogo UNE 178503 types)
-- =============================================================================

CREATE TABLE tipologia (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_code       VARCHAR(100) UNIQUE NOT NULL,  -- 'Hotel', 'Beach', etc.
    schema_org_type VARCHAR(100),                   -- equivalente schema.org
    grupo           VARCHAR(50) NOT NULL,            -- 'alojamiento', 'restauracion', etc.
    activo          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CATEGORIAS (jerarquicas)
-- =============================================================================

CREATE TABLE categoria (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        VARCHAR(200) UNIQUE NOT NULL,
    parent_id   UUID REFERENCES categoria(id),
    orden       INTEGER DEFAULT 0,
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PRODUCTO TURISTICO
-- =============================================================================

CREATE TABLE producto_turistico (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        VARCHAR(200) UNIQUE NOT NULL,
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- RECURSO TURISTICO (entidad central)
-- =============================================================================

CREATE TABLE recurso_turistico (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uri                     VARCHAR(500) UNIQUE NOT NULL,
    rdf_type                VARCHAR(100) NOT NULL,
    rdf_types               VARCHAR(100)[] DEFAULT '{}',
    slug                    VARCHAR(300) UNIQUE NOT NULL,

    -- Ubicacion
    municipio_id            UUID REFERENCES municipio(id),
    zona_id                 UUID REFERENCES zona(id),
    latitude                NUMERIC(10, 7),
    longitude               NUMERIC(10, 7),
    geo                     GEOMETRY(Point, 4326),
    address_street          VARCHAR(500),
    address_postal          VARCHAR(10),

    -- Contacto
    telephone               VARCHAR(20)[] DEFAULT '{}',
    email                   VARCHAR(255)[] DEFAULT '{}',
    url                     VARCHAR(500),
    same_as                 VARCHAR(500)[] DEFAULT '{}',

    -- Clasificacion turistica (UNE 178503 touristType)
    tourist_types           VARCHAR(100)[] DEFAULT '{}',

    -- Atributos especificos
    rating_value            INTEGER CHECK (rating_value IS NULL OR rating_value BETWEEN 1 AND 6),
    serves_cuisine          VARCHAR(100)[] DEFAULT '{}',
    is_accessible_for_free  BOOLEAN,
    public_access           BOOLEAN,
    occupancy               INTEGER,
    opening_hours           VARCHAR(500),

    -- Extras UNE 178503
    extras                  JSONB DEFAULT '{}',

    -- Editorial
    estado_editorial        VARCHAR(20) DEFAULT 'borrador'
                            CHECK (estado_editorial IN ('borrador', 'revision', 'publicado', 'archivado')),
    visible_en_mapa         BOOLEAN DEFAULT true,
    published_at            TIMESTAMPTZ,

    -- Auditoria
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    created_by              UUID REFERENCES usuario(id),
    updated_by              UUID REFERENCES usuario(id)
);

-- Indices
CREATE INDEX idx_recurso_tipo ON recurso_turistico(rdf_type);
CREATE INDEX idx_recurso_municipio ON recurso_turistico(municipio_id);
CREATE INDEX idx_recurso_zona ON recurso_turistico(zona_id);
CREATE INDEX idx_recurso_estado ON recurso_turistico(estado_editorial);
CREATE INDEX idx_recurso_slug ON recurso_turistico(slug);
CREATE INDEX idx_recurso_geo ON recurso_turistico USING GIST(geo);
CREATE INDEX idx_recurso_published ON recurso_turistico(published_at) WHERE estado_editorial = 'publicado';

-- =============================================================================
-- RELACIONES ENTRE RECURSOS
-- =============================================================================

CREATE TABLE relacion_recurso (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurso_origen  UUID NOT NULL REFERENCES recurso_turistico(id) ON DELETE CASCADE,
    recurso_destino UUID NOT NULL REFERENCES recurso_turistico(id) ON DELETE CASCADE,
    tipo_relacion   VARCHAR(50) NOT NULL,
    orden           INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(recurso_origen, recurso_destino, tipo_relacion)
);

CREATE INDEX idx_relacion_origen ON relacion_recurso(recurso_origen);
CREATE INDEX idx_relacion_destino ON relacion_recurso(recurso_destino);

-- =============================================================================
-- ASOCIACIONES M:N
-- =============================================================================

CREATE TABLE recurso_categoria (
    recurso_id   UUID REFERENCES recurso_turistico(id) ON DELETE CASCADE,
    categoria_id UUID REFERENCES categoria(id) ON DELETE CASCADE,
    PRIMARY KEY (recurso_id, categoria_id)
);

CREATE TABLE recurso_producto (
    recurso_id  UUID REFERENCES recurso_turistico(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES producto_turistico(id) ON DELETE CASCADE,
    PRIMARY KEY (recurso_id, producto_id)
);

-- =============================================================================
-- TRADUCCIONES (generica para cualquier entidad)
-- =============================================================================

CREATE TABLE traduccion (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_tipo VARCHAR(50) NOT NULL,
    entidad_id   UUID NOT NULL,
    campo        VARCHAR(100) NOT NULL,
    idioma       VARCHAR(5) NOT NULL,
    valor        TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entidad_tipo, entidad_id, campo, idioma)
);

CREATE INDEX idx_traduccion_entidad ON traduccion(entidad_tipo, entidad_id);
CREATE INDEX idx_traduccion_idioma ON traduccion(idioma);

-- =============================================================================
-- MULTIMEDIA
-- =============================================================================

CREATE TABLE asset_multimedia (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_tipo  VARCHAR(50) NOT NULL,
    entidad_id    UUID NOT NULL,
    tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('imagen', 'video', 'audio')),
    url           VARCHAR(1000) NOT NULL,
    alt_text      JSONB DEFAULT '{}',
    mime_type     VARCHAR(100),
    size_bytes    BIGINT,
    width         INTEGER,
    height        INTEGER,
    orden         INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asset_entidad ON asset_multimedia(entidad_tipo, entidad_id);

-- =============================================================================
-- DOCUMENTOS DESCARGABLES
-- =============================================================================

CREATE TABLE documento_descargable (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_tipo  VARCHAR(50) NOT NULL,
    entidad_id    UUID NOT NULL,
    url           VARCHAR(1000) NOT NULL,
    nombre        JSONB DEFAULT '{}',
    mime_type     VARCHAR(100),
    size_bytes    BIGINT,
    orden         INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documento_entidad ON documento_descargable(entidad_tipo, entidad_id);

-- =============================================================================
-- PAGINAS EDITORIALES
-- =============================================================================

CREATE TABLE pagina (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug             VARCHAR(300) UNIQUE NOT NULL,
    template         VARCHAR(100) DEFAULT 'default',
    estado_editorial VARCHAR(20) DEFAULT 'borrador'
                     CHECK (estado_editorial IN ('borrador', 'revision', 'publicado', 'archivado')),
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    created_by       UUID REFERENCES usuario(id),
    updated_by       UUID REFERENCES usuario(id)
);

-- =============================================================================
-- NAVEGACION WEB (gestionable desde CMS)
-- =============================================================================

CREATE TABLE navegacion (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_slug   VARCHAR(100) NOT NULL,
    parent_id   UUID REFERENCES navegacion(id),
    tipo        VARCHAR(50) NOT NULL CHECK (tipo IN ('pagina', 'recurso', 'url_externa', 'categoria', 'tipologia')),
    referencia  VARCHAR(500),
    orden       INTEGER DEFAULT 0,
    visible     BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_navegacion_menu ON navegacion(menu_slug);

-- =============================================================================
-- LOG DE CAMBIOS (auditoria)
-- =============================================================================

CREATE TABLE log_cambios (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_tipo  VARCHAR(50) NOT NULL,
    entidad_id    UUID NOT NULL,
    accion        VARCHAR(20) NOT NULL CHECK (accion IN ('crear', 'modificar', 'eliminar', 'publicar', 'archivar')),
    usuario_id    UUID REFERENCES usuario(id),
    cambios       JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_log_entidad ON log_cambios(entidad_tipo, entidad_id);
CREATE INDEX idx_log_fecha ON log_cambios(created_at);

-- =============================================================================
-- TRABAJOS DE EXPORTACION
-- =============================================================================

CREATE TABLE export_job (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo            VARCHAR(50) NOT NULL CHECK (tipo IN ('pid', 'datalake', 'csv', 'json')),
    estado          VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completado', 'error')),
    parametros      JSONB DEFAULT '{}',
    resultado       JSONB DEFAULT '{}',
    total_registros INTEGER DEFAULT 0,
    registros_ok    INTEGER DEFAULT 0,
    registros_error INTEGER DEFAULT 0,
    iniciado_at     TIMESTAMPTZ,
    finalizado_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      UUID REFERENCES usuario(id)
);

-- =============================================================================
-- TRIGGER: actualizar updated_at automaticamente
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_recurso BEFORE UPDATE ON recurso_turistico
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_pagina BEFORE UPDATE ON pagina
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_traduccion BEFORE UPDATE ON traduccion
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_usuario BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TRIGGER: auto-generar geo point desde lat/lon
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_geo_point()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geo = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    ELSE
        NEW.geo = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_geo_recurso BEFORE INSERT OR UPDATE ON recurso_turistico
    FOR EACH ROW EXECUTE FUNCTION trigger_set_geo_point();

CREATE TRIGGER set_geo_municipio BEFORE INSERT OR UPDATE ON municipio
    FOR EACH ROW EXECUTE FUNCTION trigger_set_geo_point();
