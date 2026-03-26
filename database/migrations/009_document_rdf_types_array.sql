-- =============================================================================
-- Migration 009: Document rdf_types[] field usage
-- =============================================================================
-- The column recurso_turistico.rdf_types (VARCHAR[]) exists since migration 001
-- but is currently unused by the API and CMS.
--
-- Primary type: rdf_type (singular) — used everywhere
-- Secondary types: rdf_types (array) — reserved for multi-classification
--
-- Example: A Pazo could be both 'LandmarksOrHistoricalBuildings' AND 'Winery'
--   rdf_type = 'LandmarksOrHistoricalBuildings'  (primary, used for filtering)
--   rdf_types = '{Winery,TouristAttraction}'      (secondary, future use)
--
-- TODO (E2): Expose rdf_types in admin API and CMS form as multi-select
-- No schema change needed — column already exists.

-- Add a comment to the column for documentation
COMMENT ON COLUMN recurso_turistico.rdf_types IS 'Secondary UNE 178503 types (array). Primary type is rdf_type. Reserved for multi-classification in E2.';
