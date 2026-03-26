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

## Execution

Migrations run via Supabase SQL Editor or `supabase db push`.
Always backup before running migrations in production.
