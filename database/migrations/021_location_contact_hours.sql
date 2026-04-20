-- ==========================================================================
-- Migration 021 — Ubicación, contacto y horarios estructurados (paso 3)
-- ==========================================================================
--
-- Corrección del prompt original: la tabla real del schema es
-- `public.recurso_turistico` (no `public.resources`, que era el nombre
-- asumido por el prompt). Mismo ajuste que se hizo en las migraciones 018
-- y 020 del paso 0. Reemplazo aplicado a los DDL, los índices, la vista y
-- los SELECT de information_schema.
--
-- WHY
-- ---
-- El paso 3 del wizard pasa de textareas libres a datos estructurados
-- alineados con UNE 178503 / PID (hasLocation, hasContactPoint,
-- hasOpeningHours, sameAs).
--
-- Esta migración añade las columnas necesarias y es IDEMPOTENTE: usa
-- `if not exists` y `do $$ ... $$` para que se pueda correr varias veces
-- sin efectos laterales. NO borra columnas legacy — esa limpieza va en
-- otra migración posterior una vez verificado que el backfill es correcto.
--
-- Cobertura:
--
--   1. Dirección estructurada
--      - street_address, postal_code, locality, parroquia
--      (lat/lng ya existen desde migraciones anteriores)
--
--   2. Contacto
--      - contact_phone, contact_email, contact_web
--      - social_links JSONB[] alineado con sameAs de schema.org
--
--   3. Horarios estructurados
--      - opening_hours_plan JSONB — las 7 plantillas (always, weekly,
--        seasonal, appointment, event, external, closed) + cierres
--        temporales. Ver shared/data/opening-hours.ts para el shape.
--      - Dejamos opening_hours_text (legacy, textarea) intacto para
--        backfill manual opcional.
-- ==========================================================================


-- 1) Dirección estructurada ------------------------------------------------

do $$
begin
  -- street_address: calle + número
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'street_address'
  ) then
    alter table public.recurso_turistico add column street_address text;
    comment on column public.recurso_turistico.street_address is
      'Dirección postal (calle y número). Se mapea a schema.org streetAddress.';
  end if;

  -- postal_code
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'postal_code'
  ) then
    alter table public.recurso_turistico add column postal_code text;
    comment on column public.recurso_turistico.postal_code is
      'Código postal. Se mapea a schema.org postalCode.';
  end if;

  -- locality: municipio como texto legible (adicional a municipio_id FK)
  -- Útil cuando viene de geocoding reverso y el municipio no está en
  -- la tabla municipios.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'locality'
  ) then
    alter table public.recurso_turistico add column locality text;
    comment on column public.recurso_turistico.locality is
      'Municipio como texto (auto-rellenado por geocoding). Se mapea a schema.org addressLocality.';
  end if;

  -- parroquia como texto libre (distinto de zona_id FK)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'parroquia_text'
  ) then
    alter table public.recurso_turistico add column parroquia_text text;
    comment on column public.recurso_turistico.parroquia_text is
      'Parroquia o barrio como texto libre. Complementa zona_id si está puesto.';
  end if;
end $$;


-- 2) Contacto --------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'contact_phone'
  ) then
    alter table public.recurso_turistico add column contact_phone text;
    comment on column public.recurso_turistico.contact_phone is
      'Teléfono principal con prefijo internacional. Se mapea a schema.org telephone.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'contact_email'
  ) then
    alter table public.recurso_turistico add column contact_email text;
    comment on column public.recurso_turistico.contact_email is
      'Email de contacto. Se mapea a schema.org email.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'contact_web'
  ) then
    alter table public.recurso_turistico add column contact_web text;
    comment on column public.recurso_turistico.contact_web is
      'URL del sitio web. Se mapea a schema.org url.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'social_links'
  ) then
    alter table public.recurso_turistico add column social_links jsonb not null default '[]'::jsonb;
    comment on column public.recurso_turistico.social_links is
      'Enlaces a redes sociales. Array de { platform, url }. Se mapea a schema.org sameAs (array de URLs).';
  end if;
end $$;


-- 3) Horarios estructurados ------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico'
      and column_name = 'opening_hours_plan'
  ) then
    alter table public.recurso_turistico add column opening_hours_plan jsonb;
    comment on column public.recurso_turistico.opening_hours_plan is
      'Plan estructurado de horarios. Discriminated union por `kind` (always/weekly/seasonal/appointment/event/external/closed) + closures[] ortogonales + note. Ver shared/data/opening-hours.ts para el shape. Mapea a schema.org OpeningHoursSpecification + specialOpeningHoursSpecification.';
  end if;
end $$;


-- 4) Índice GIN sobre social_links y opening_hours_plan --------------------
--
-- Opcional pero útil para queries del tipo "recursos con Instagram" o
-- "recursos abiertos todo el año".

create index if not exists idx_resources_social_links
  on public.recurso_turistico using gin (social_links);

create index if not exists idx_resources_opening_hours_kind
  on public.recurso_turistico ((opening_hours_plan ->> 'kind'));


-- 5) Índice sobre lat/lng para búsquedas espaciales ------------------------
--
-- Solo si existen las columnas (sin reemplazar si ya existe índice).
-- Nombre de columnas flexible por si varía en distintos entornos.

-- IF EXISTS directo en vez de variables boolean intermedias. Postgres con
-- check_function_bodies=on interpretaba `has_lat`/`has_lng` como relations
-- (42P01) — mismo fix que aplicamos en la migración 020 (_warn_legacy_tipology).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico' and column_name = 'latitude'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurso_turistico' and column_name = 'longitude'
  ) then
    execute 'create index if not exists idx_resources_latlng
             on public.recurso_turistico (latitude, longitude)
             where latitude is not null and longitude is not null';
  end if;
end $$;


-- 6) Vista auxiliar: recursos georreferenciados -----------------------------
--
-- Facilita consultar desde la web pública "recursos con coordenadas
-- válidas y visibles en mapa" sin escribir el filtro cada vez.

create or replace view public.v_resources_geolocated as
  select r.*
  from public.recurso_turistico r
  where r.latitude is not null
    and r.longitude is not null
    and r.latitude between -90 and 90
    and r.longitude between -180 and 180;

comment on view public.v_resources_geolocated is
  'Recursos con coordenadas geográficas válidas. Se usa desde el mapa público y desde el export a PID.';
