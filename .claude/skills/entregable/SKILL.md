---
name: entregable
description: Generate or update a contractual deliverable document (E1, E2, E3). Formal documents for payment milestones.
argument-hint: [E1, E2, or E3]
disable-model-invocation: true
---

Generate/update Entregable "$ARGUMENTS" for DTI O Salnes.

## Deliverable definitions

### E1 (30% = ~28.500 EUR) — Analisis y arquitectura
Already delivered: `docs/entregables/E1_Analisis_Arquitectura.md`
Contains: requirements analysis, architecture, UNE 178503 data model, PID interoperability, planning.

### E2 (40% = ~38.000 EUR) — CMS + Web operativos
Must demonstrate:
- CMS fully functional with all CRUD sections
- Web portal with map, search, resource detail pages
- WCAG 2.1 AA compliance (Lighthouse evidence)
- API endpoints working (JSON-LD export)
- 15+ real tourist resources loaded
- AI assistant working (mock or real)
Evidence files: `docs/evidencias/`, `docs/entregables/E2_WCAG_Auditoria.md`

### E3 (30% = ~28.500 EUR) — Documentation + manuals
Must include:
- OpenAPI spec (`docs/openapi.yaml`)
- Technical manual (DOCUMENTATION.md)
- User manual for CMS operators
- Reversibility plan
- Training documentation (>=20 hours committed)

## Process

1. Read the existing deliverable if it exists
2. Read the project state (git log, file list, features implemented)
3. Generate/update the document in `docs/entregables/E{n}_{name}.md`
4. Include: date, version, compliance matrix, evidence references
5. Format: formal technical document suitable for public administration review
