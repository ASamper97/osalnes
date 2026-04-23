/**
 * Copy del Centro de exportaciones (SCR-13)
 */

export const EXPORTS_COPY = {
  header: {
    title: 'Centro de exportaciones',
    subtitle: 'Exporta el catálogo al PID, Data Lake o formatos abiertos · UNE 178503',
    launchButton: '+ Nueva exportación',
    refreshButton: 'Actualizar',
  },

  kpis: {
    totalJobs: 'Total exportaciones',
    success24h: 'Éxitos 24 h',
    failed24h: 'Errores 24 h',
    pending: 'En cola',
    running: 'En proceso',
    avgDuration: 'Duración media',
    lastSuccess: 'Última exportación OK',
  },

  filters: {
    title: 'Filtros',
    statusLabel: 'Estado',
    statusAll: 'Todos los estados',
    jobTypeLabel: 'Tipo',
    jobTypeAll: 'Todos los tipos',
    dateFromLabel: 'Desde',
    dateToLabel: 'Hasta',
    onlyMineLabel: 'Solo las mías',
    clearLabel: 'Limpiar filtros',
  },

  table: {
    columns: {
      type: 'Tipo',
      status: 'Estado',
      scope: 'Alcance',
      records: 'Recursos',
      started: 'Inicio',
      duration: 'Duración',
      triggeredBy: 'Lanzado por',
      actions: 'Acciones',
    },
    retryBadge: 'Reintento',
    viewDetailButton: 'Ver detalle',
    emptyTitle: 'No hay exportaciones que coincidan con los filtros',
    emptyHint: 'Cambia los filtros o lanza la primera exportación al PID.',
  },

  launcher: {
    title: 'Nueva exportación',

    step1Label: '1. Tipo de exportación',
    step1Hint: 'Elige el sistema destino',

    step2Label: '2. Alcance',
    step2Hint: 'Qué recursos se van a exportar',
    scopeAllPublished: 'Todos los publicados',
    scopeAllPublishedHint: 'Incluye todos los recursos con estado "Publicado"',
    scopeFiltered: 'Filtro personalizado',
    scopeFilteredHint: 'Aplica filtros de tipología, municipio y estado',
    scopeSelected: 'Recursos seleccionados',
    scopeSelectedHint: 'Usa una lista explícita de IDs (avanzado)',

    step3Label: '3. Pre-validación',
    step3Hint: 'Comprobando qué recursos pasan la validación…',
    validationTotal: '{count} recursos en el alcance',
    validationPassing: '{count} pasan la validación ✓',
    validationFailing: '{count} con errores bloqueantes ✗',
    validationSampleTitle: 'Primeros errores detectados:',
    validationAllPassing: 'Todos los recursos pasan la validación. Puedes lanzar con seguridad.',
    validationAllFailing: 'Ningún recurso pasa la validación. Corrige los errores antes de exportar.',

    notesLabel: 'Notas (opcional)',
    notesPlaceholder: 'Ej: export mensual para el PID',

    cancelButton: 'Cancelar',
    launchButton: 'Lanzar exportación',
    launchDisabledHint: 'Necesitas al menos un recurso que pase la validación',
  },

  statusMessages: {
    success: 'Exportación creada correctamente. Procesando en segundo plano…',
    error: 'No se ha podido crear la exportación',
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────

export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}
