export * from './constants/index.js';
export * from './types/index.js';
// Los catálogos UNE 178503 (tag-catalog, resource-type-catalog) se exponen
// por subpath dedicado para evitar churn en los consumidores del CMS. Ver
// package.json#exports. Las plantillas del wizard (resource-templates) sí
// se re-exportan desde el barrel porque las usa el picker del paso 0 y son
// un API pequeño y estable.
export * from './data/resource-templates.js';
