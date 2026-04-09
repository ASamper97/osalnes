# Database Migrations

## Convention

- `NNN_description.sql` — UP migration (apply changes)
- `NNN_description.down.sql` — DOWN migration (rollback)

## Migrations

| # | Description | DOWN available |
|---|-------------|---------------|
| 001 | Initial schema (all tables) | No — destructive, use backup restore |
| 002 | Add storage_path to assets | No — column removal risks data loss |
| 003 | Fix municipio names + add Otro/Varios | No — data change, use backup restore |
| 004 | Add storage_path to documents | No — column removal risks data loss |
| 005 | Fix export_job column names | Yes |
| 006 | Add assistant_log table | Yes |
| 007 | Add translation_job table | Yes |
| 008 | Add translation campo index | Yes |
| 009 | Document RDF types array | No |
| 010 | Enable Row Level Security baseline (defense-in-depth, anon key) | Yes |
| 011 | Link usuario.auth_user_id to auth.users.id (stable lookup) | Yes |
| 012 | GDPR retention function for log_cambios (anonymize old actor refs) | Yes |
| 013 | Extend log_cambios.accion CHECK to allow 'anonimizar' (fix for 012) | Yes |
| 014 | zona schema hardening: updated_at, created_by, updated_by, slug-per-municipio, NOT NULL, indexes | Yes |
| 015 | Atomic create_zona / update_zona RPCs (fixes audit A6) | Yes |
| 016 | Optimistic concurrency control for update_zona (fixes audit DF3) | Yes |
| 017 | Seed parroquias of the 9 O Salnés concellos (audit F2) | Yes |

## Execution

Migrations run via Supabase SQL Editor or `supabase db push`.
Always backup before running migrations in production.
