/**
 * Copy del gestor de taxonomías · SCR-10 v2
 *
 * Cambios v2: añade labels para el campo `grupo` (tipologias).
 */

export const TAXONOMIES_COPY = {
  header: {
    title: 'Gestor de taxonomías',
    subtitle: 'Mantén tipologías, municipios, zonas, categorías y productos turísticos desde una única pantalla.',
  },

  masterList: {
    title: 'Catálogos',
    hint: 'Selecciona un catálogo para gestionar sus términos.',
    readonlyLabel: '(solo lectura)',
  },

  toolbar: {
    newButton: 'Nuevo término',
    searchPlaceholder: 'Buscar…',
    showInactive: 'Mostrar inactivos',
    sortByOrder: 'Orden',
    sortByName: 'Alfabético',
    sortByUsage: 'Más usados',
  },

  list: {
    emptyTitle: 'Sin términos',
    emptyHint: 'Crea el primero con el botón "Nuevo término".',
    usageLabel: 'Uso:',
    usagePublished: '{count} publicados',
    usageDraft: '{count} en borrador',
    activeLabel: 'Activo',
    inactiveLabel: 'Inactivo',
    hasChildrenLabel: 'Con subcategorías',
    noSemanticUriHint: '⚠ Sin URI semántica',
    editButton: 'Editar',
    viewUsageButton: 'Ver uso',
    toggleActiveOn: 'Activar',
    toggleActiveOff: 'Desactivar',
    grupoLabel: 'Grupo:',
  },

  editor: {
    titleCreate: 'Crear nuevo término',
    titleEdit: 'Editar término',
    closeButton: 'Cancelar',
    saveButton: 'Guardar',
    saving: 'Guardando…',

    slugLabel: 'Código (type_code para tipologías)',
    slugHint: 'Identificador único. Sin espacios. Para tipologías coincide con el valor de rdf_type en recurso_turistico. Ej: "Beach".',
    slugRequired: 'El código es obligatorio.',

    parentLabel: 'Término padre (opcional)',
    parentNone: '— Ninguno (nivel raíz) —',

    sortOrderLabel: 'Orden de presentación',
    sortOrderHint: 'Número menor → aparece antes.',

    isActiveLabel: 'Activo',
    isActiveHint: 'Si desactivas, los recursos existentes mantienen la referencia pero el término no aparecerá en los selectores.',

    semanticUriLabel: 'URI semántica',
    semanticUriHint: 'URL del vocabulario semántico. Ej: https://schema.org/Beach. Opcional pero necesario para exportación al PID.',

    schemaCodeLabel: 'Código schema.org (schema_org_type)',
    schemaCodeHint: 'Tipo schema.org al que equivale. Ej: "Beach" para playas, "LodgingBusiness" para ApartHotel.',

    grupoLabel: 'Grupo',
    grupoHint: 'Categoría operativa interna. Clasifica la tipología para filtros del CMS.',
    grupoPlaceholder: '— Seleccionar grupo —',

    translationsTitle: 'Traducciones',
    translationsHint: 'Al menos una versión en castellano es recomendable. El gallego se rellena automáticamente desde el español si lo dejas vacío.',
    tabEs: 'Castellano (ES)',
    tabGl: 'Galego (GL)',
    tabEn: 'English (EN)',
    nameLabel: 'Nombre',
    descriptionLabel: 'Descripción corta',
    namePlaceholder: 'Nombre del término',
    descriptionPlaceholder: 'Breve descripción…',

    semanticWarningTitle: 'Aviso sobre la URI',
    validationSuccess: 'Término guardado correctamente.',
  },

  usage: {
    title: 'Recursos que usan este término',
    loading: 'Cargando…',
    empty: 'Ningún recurso está usando este término actualmente.',
    viewAllButton: 'Ver los {count} en el listado →',
    closeButton: 'Cerrar',
    noUsageForCatalog: 'El uso de este catálogo no se refleja directamente en recursos. Se gestiona como clasificación secundaria.',
  },

  confirmToggle: {
    deactivateTitle: '¿Desactivar este término?',
    deactivateBody: 'Los {count} recursos que lo usan mantendrán la referencia, pero el término no aparecerá en los selectores de nuevos recursos. Podrás reactivarlo más adelante.',
    activateTitle: '¿Reactivar este término?',
    activateBody: 'El término volverá a estar disponible en los selectores.',
    confirmButton: 'Sí, continuar',
    cancelButton: 'Cancelar',
  },

  readonlyBanner: {
    municipio: 'Los municipios son los 9 concellos oficiales de O Salnés. Puedes editar sus traducciones desde cada municipio individual, pero no crear ni borrar municipios nuevos.',
  },

  noPermissionBanner: 'No tienes permisos para editar este catálogo. Puedes consultar los términos pero no modificarlos.',
} as const;

export function interpolateTx(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));
}
