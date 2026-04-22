/**
 * Copy del Dashboard (SCR-02). Tildes correctas en todo.
 */

export const DASHBOARD_COPY = {
  header: {
    title: 'Dashboard',
    subtitle: 'Panel de control operativo · UNE 178502',
    refreshButton: 'Actualizar',
    lastRefreshedLabel: 'Actualizado {when}',
    autoRefreshHint: 'Actualización automática cada minuto',
  },

  alerts: {
    incompleteForPublish: '{count} {recurso} con datos obligatorios sin rellenar',
    incompleteForPublishAction: 'Revisarlos',
    withoutCoordinates: '{count} {recurso} {visible} en mapa sin coordenadas',
    withoutCoordinatesAction: 'Corregir',
    withoutImage: '{count} {recurso} sin imagen principal',
    withoutImageAction: 'Añadir imágenes',
    pidNotExported: 'Sin exportaciones al PID registradas',
    pidNotExportedAction: 'Ir a exportaciones',
  },

  quickActions: {
    title: 'Accesos rápidos',
    emptyHint: 'No hay acciones disponibles para tu rol.',
  },

  myWork: {
    title: 'Mi trabajo',
    subtitle: 'Tus borradores de las últimas 2 semanas',
    emptyTitle: 'No tienes borradores pendientes',
    emptyHint: 'Cuando crees un recurso, aparecerá aquí hasta que lo publiques.',
    continueLabel: 'Continuar',
    viewAllLabel: 'Ver todos mis borradores',
  },

  statusKpis: {
    title: 'Estado del trabajo',
    total: 'Totales',
    published: 'Publicados',
    scheduled: 'Programados',
    draft: 'Borradores',
    archived: 'Archivados',
    incompleteForPublish: 'Incompletos',
  },

  upcomingScheduled: {
    title: 'Próximas publicaciones',
    subtitle: 'Recursos con publicación programada',
    emptyTitle: 'No hay publicaciones programadas',
    emptyHint: 'Puedes programar una publicación desde el paso 7 del editor.',
    cancelScheduleLabel: 'Cancelar programación',
    editLabel: 'Editar',
    viewAllLabel: 'Ver todos los programados',
  },

  uneIndicators: {
    title: 'Indicadores UNE 178502',
    subtitle: 'Alineamiento con la norma de Destinos Turísticos Inteligentes',
    digitalization: {
      label: 'Digitalización',
      description: 'Recursos con datos estructurados completos',
    },
    multilingualism: {
      label: 'Multilingüismo',
      description: 'Recursos con ES y GL como mínimo',
    },
    georeferencing: {
      label: 'Georreferenciación',
      description: 'Recursos visibles en mapa con coordenadas',
    },
    freshness30d: {
      label: 'Actualización (30 días)',
      description: 'Recursos modificados últimos 30 días',
    },
    freshness90d: {
      label: 'Actualización (90 días)',
      description: 'Recursos modificados últimos 90 días',
    },
    pidInterop: {
      label: 'Interoperabilidad PID',
      description: 'Exportación exitosa al PID/Data Lake',
    },
  },

  translationProgress: {
    title: 'Completitud de traducciones',
    subtitle: 'Porcentaje de recursos publicados con contenido en cada idioma',
    emptyHint: 'Aún no hay recursos publicados para calcular traducciones.',
  },

  dataQuality: {
    title: 'Calidad del dato',
    withDescription: 'Con descripción',
    withImages: 'Con imágenes',
    withCoordinates: 'Con coordenadas',
  },

  catalogContext: {
    title: 'Catálogo del destino',
    municipalities: 'Municipios',
    categories: 'Categorías',
  },

  lastExport: {
    title: 'Última exportación PID',
    none: 'Sin exportaciones registradas',
    successLabel: 'Exportación exitosa',
    failedLabel: 'Exportación con errores',
    partialLabel: 'Exportación parcial',
    runningLabel: 'Exportación en curso',
    viewHistoryLabel: 'Ver historial',
  },

  recentActivity: {
    title: 'Actividad reciente',
    emptyHint: 'Aún no hay actividad registrada.',
    actionLabels: {
      created: 'creó',
      updated: 'modificó',
      published: 'publicó',
      archived: 'archivó',
      deleted: 'eliminó',
    } as Record<string, string>,
  },

  common: {
    loading: 'Cargando…',
    error: 'No se ha podido cargar esta sección',
    retry: 'Reintentar',
    viewAll: 'Ver todos',
    refreshNow: 'Actualizar ahora',
  },
} as const;

// ─── Helper: pluralización simple ─────────────────────────────────────

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
