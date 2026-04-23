/**
 * Copy de Fase B · Drawer de detalle, retry, descargas.
 */

export const EXPORTS_DETAIL_COPY = {
  drawer: {
    closeLabel: 'Cerrar',
    closeAriaLabel: 'Cerrar panel de detalle',
    loading: 'Cargando detalle…',
    notFound: 'Este job no existe o ha sido eliminado.',
  },

  header: {
    jobIdLabel: 'ID del job',
    retryBadge: '↻ Reintento',
    retryOfLabel: 'Reintento de',
  },

  tabs: {
    summary: 'Resumen',
    payload: 'Payload',
    errors: 'Errores',
    records: 'Records',
  },

  summary: {
    statusLabel: 'Estado',
    typeLabel: 'Tipo',
    scopeLabel: 'Alcance',
    startedLabel: 'Inicio',
    finishedLabel: 'Fin',
    durationLabel: 'Duración',
    triggeredByLabel: 'Lanzado por',
    totalLabel: 'Recursos totales',
    okLabel: 'Exportados OK',
    failedLabel: 'Fallidos',
    skippedLabel: 'Saltados',
    notesLabel: 'Notas',
    errorBreakdownTitle: 'Errores por categoría',
  },

  payload: {
    emptyTitle: 'Aún no hay payload',
    emptyHint: 'El payload aparecerá cuando el job termine de procesar.',
    selectRecordHint: 'Selecciona un recurso de la lista para ver su payload.',
    copyButton: 'Copiar',
    copiedLabel: '✓ Copiado',
  },

  errors: {
    emptyTitle: 'Sin errores',
    emptyHint: 'Todos los recursos se exportaron correctamente.',
    detailsToggleShow: 'Ver detalles técnicos',
    detailsToggleHide: 'Ocultar detalles técnicos',
    categoryLabel: 'Categoría',
    resourceLabel: 'Recurso',
    messageLabel: 'Mensaje',
    openResourceButton: 'Abrir recurso',
  },

  records: {
    filterAll: 'Todos',
    filterSuccess: 'Solo OK',
    filterFailed: 'Solo fallidos',
    empty: 'No hay recursos para mostrar con este filtro.',
    columnResource: 'Recurso',
    columnStatus: 'Estado',
    columnCategory: 'Categoría',
    columnMessage: 'Detalle',
  },

  actions: {
    downloadTitle: 'Descargas',
    downloadBundle: 'Descargar payload (.json)',
    downloadBundleHint: 'JSON completo con todos los recursos procesados, éxitos y fallos.',
    downloadLogSanitized: 'Descargar log (.txt)',
    downloadLogSanitizedHint: 'Log legible con datos personales truncados.',
    downloadLogFull: 'Descargar log completo',
    downloadLogFullHint: 'Incluye emails, teléfonos y payloads completos. Solo admin.',
    downloadLogFullAdminOnly: 'Solo administradores',
    downloading: 'Descargando…',

    retryTitle: 'Reintentar',
    retryButton: '↻ Reintentar job',
    retryDisabledRunning: 'Espera a que termine para reintentar',
    retryDisabledPending: 'El job aún está en cola',
  },

  retryDialog: {
    title: 'Reintentar exportación',
    hint: '¿Qué recursos quieres reprocesar?',
    modeAllLabel: 'Reintentar todo',
    modeAllHint: 'Reprocesa los {total} recursos del job original, incluidos los que ya fueron bien.',
    modeFailedLabel: 'Solo reintentar fallidos',
    modeFailedHint: 'Reprocesa solo los {failed} recursos que fallaron.',
    modeFailedDisabled: 'No hay recursos fallidos que reintentar',
    confirmButton: 'Crear reintento',
    cancelButton: 'Cancelar',
    creating: 'Creando…',
    successToast: 'Reintento creado. Procesando en segundo plano…',
  },
} as const;

export function interpolateDetail(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));
}
