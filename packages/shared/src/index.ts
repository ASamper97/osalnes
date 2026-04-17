export * from './constants/index.js';
export * from './types/index.js';
// Los catálogos UNE 178503 se exponen por subpath dedicado para evitar
// problemas de CJS interop en Rollup con re-exports de funciones. Los
// consumidores importan desde `@osalnes/shared/data/tag-catalog` y
// `@osalnes/shared/data/resource-type-catalog` (ver package.json#exports).
