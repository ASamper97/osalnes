---
name: db-migration
description: Create a new database migration file with correct numbering and SQL. Use when schema changes are needed.
argument-hint: [description of what to change, e.g. "add column images_count to recurso_turistico"]
disable-model-invocation: true
---

Create a database migration for: "$ARGUMENTS"

## Process

1. Check the latest migration number in `database/migrations/`
2. Create new file: `database/migrations/{next_number}_{slug}.sql`
3. Write the SQL with:
   - Comment header explaining the migration
   - `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX`, etc.
   - Use `IF NOT EXISTS` where appropriate
   - Follow existing naming conventions (snake_case, Spanish entity names)
4. If the migration needs to run in Supabase production, output the SQL for the user to paste in SQL Editor

## Naming conventions (from existing schema)
- Tables: `recurso_turistico`, `producto_turistico`, `log_cambios`
- Columns: `estado_editorial`, `visible_en_mapa`, `created_at`
- Indexes: `idx_{table}_{column}`
- Foreign keys: `REFERENCES {table}(id)`
- UUID primary keys: `DEFAULT uuid_generate_v4()`
- Timestamps: `TIMESTAMPTZ DEFAULT NOW()`

## Output
1. The migration file content
2. "Execute this SQL in Supabase SQL Editor" instruction if needed
3. Any code changes required (TypeScript types, services, etc.)
