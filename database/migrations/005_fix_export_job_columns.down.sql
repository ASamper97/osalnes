-- DOWN: Revert export_job column renames
ALTER TABLE export_job RENAME COLUMN registros_err TO registros_error;
ALTER TABLE export_job RENAME COLUMN completed_at TO finalizado_at;
ALTER TABLE export_job RENAME COLUMN started_at TO iniciado_at;
