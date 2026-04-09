-- Rollback for migration 012 — drop the GDPR retention helper.
-- Does NOT undo any anonymizations already performed (those are irreversible
-- by design — that's the whole point).

DROP FUNCTION IF EXISTS anonymize_audit_logs_older_than(INTEGER);
