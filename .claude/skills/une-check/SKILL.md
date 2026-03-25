---
name: une-check
description: Verify compliance with UNE 178502/178503 standards for Smart Tourism Destinations. Check data model, indicators, interoperability.
argument-hint: [section to check, e.g. "data-model", "indicators", "interoperability", or "all"]
disable-model-invocation: true
---

UNE compliance check for: "$ARGUMENTS"

## UNE 178503 — Semantica turistica

### Data model (sec. 7.2-7.8)
- [ ] Entity `recurso_turistico` with URI, rdf_type, slug
- [ ] Location: latitude, longitude, PostGIS geo, address (sec. 7.3)
- [ ] Contact: telephone[], email[], url, same_as[] (sec. 7.4)
- [ ] Typologies: 67 types in 6 groups mapped to schema.org (sec. 7.5)
- [ ] Tourist types: traveler, activity, motivation, product (sec. 7.6)
- [ ] Rating: 1-6 scale (sec. 7.7)
- [ ] Extras: JSONB extensible field (sec. 7.8)
- [ ] Multilingual: ES, GL, EN, FR, PT via `traduccion` table

### Interoperability
- [ ] JSON-LD export with schema.org vocabulary (`/export/jsonld`)
- [ ] URI format: `osalnes:recurso:{slug}`
- [ ] schema.org type mapping (SCHEMA_ORG_MAP)
- [ ] PID SEGITTUR export capability (export_job table)

## UNE 178502 — Indicadores DTI

### Content management (sec. 6.3)
- [ ] Resource counts by status (dashboard stats)
- [ ] Resources by municipality breakdown
- [ ] Resources by typology group breakdown

### Traceability (sec. 6.4)
- [ ] `log_cambios` table populated on all CRUD operations
- [ ] `audit.log()` called in admin routes for all entities

### Data quality (sec. 6.5)
- [ ] % with coordinates indicator
- [ ] % with images indicator
- [ ] % with description indicator
- [ ] Translation completeness per language

### Control panel (sec. 7.2)
- [ ] Dashboard with real KPIs
- [ ] Content quality alerts
- [ ] Export status monitoring

## Output
Compliance matrix with: requirement, status (CUMPLE/NO CUMPLE), evidence file:line.
