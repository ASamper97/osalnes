import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, type PaginatedResult, type ResourceSummary, type TypologyItem, type MunicipalityItem, type ZoneItem } from '@/lib/api';
import { SkeletonTable } from '@/components/Skeleton';
import { QrModal } from '@/components/QrModal';
import { BulkAiActions } from '@/components/BulkAiActions';
import { EmptyState } from '@/components/EmptyState';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  getSavedViews,
  saveView,
  deleteView,
  RESOURCE_BUILTIN_VIEWS,
  type SavedView,
} from '@/lib/saved-views';
import { useNotifications } from '@/lib/notifications';

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  revision: 'Revision',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

const STATUS_COLORS: Record<string, string> = {
  borrador: '#f39c12',
  revision: '#3498db',
  publicado: '#27ae60',
  archivado: '#95a5a6',
};

const TIPO_GRUPO: Record<string, string> = {
  Hotel: 'alojamiento', RuralHouse: 'alojamiento', BedAndBreakfast: 'alojamiento',
  Campground: 'alojamiento', Hostel: 'alojamiento', Apartment: 'alojamiento',
  Restaurant: 'restauracion', BarOrPub: 'restauracion', CafeOrCoffeeShop: 'restauracion',
  Winery: 'restauracion', Brewery: 'restauracion', IceCreamShop: 'restauracion',
  Beach: 'recurso', Museum: 'recurso', Park: 'recurso', TouristAttraction: 'recurso',
  ViewPoint: 'recurso', LandmarksOrHistoricalBuildings: 'recurso', Monument: 'recurso',
  Trail: 'recurso', Cave: 'recurso', NaturePark: 'recurso',
  Event: 'evento', Festival: 'evento', MusicEvent: 'evento', SportsEvent: 'evento',
  BusStation: 'transporte', Port: 'transporte', TrainStation: 'transporte',
  TouristInformationCenter: 'servicio', Hospital: 'servicio', Pharmacy: 'servicio',
};

// Transiciones permitidas (BRI-6.1)
const STATE_TRANSITIONS: Record<string, { target: string; label: string; style?: string }[]> = {
  borrador:  [{ target: 'revision', label: 'Enviar a revision' }, { target: 'archivado', label: 'Archivar', style: 'btn-danger' }],
  revision:  [{ target: 'publicado', label: 'Publicar', style: 'btn-primary' }, { target: 'borrador', label: 'Devolver a borrador' }],
  publicado: [{ target: 'archivado', label: 'Archivar' }],
  archivado: [{ target: 'borrador', label: 'Reactivar' }],
};

export function ResourcesPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { notify } = useNotifications();
  // F3: read ?zona=<id> URL param so the "click a zone → see its recursos"
  // flow from ZonesMapPage / ZonesPage works. We also keep a local cache of
  // all zones (small dataset, see use-zones P3 trade-off) so we can render
  // the zone NAME in the filter badge instead of an opaque UUID.
  const [searchParams, setSearchParams] = useSearchParams();
  const zonaFilterId = searchParams.get('zona') || '';
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const zonaFilterItem = zonaFilterId ? zones.find((z) => z.id === zonaFilterId) || null : null;

  const [resources, setResources] = useState<PaginatedResult<ResourceSummary> | null>(null);
  const [typologies, setTypologies] = useState<TypologyItem[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [searchName, setSearchName] = useState('');
  const [page, setPage] = useState(1);
  // Menú "⋯" de acciones por fila. Una fila abierta a la vez.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /** F3: clear the zona URL param without reloading. */
  function clearZonaFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('zona');
    setSearchParams(next, { replace: true });
    setPage(1);
  }
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrResource, setQrResource] = useState<{ slug: string; name: string } | null>(null);
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState('all');

  useEffect(() => {
    setSavedViews(getSavedViews('resources'));
  }, []);

  const allViews: SavedView[] = [...RESOURCE_BUILTIN_VIEWS, ...savedViews];

  function applyView(view: SavedView) {
    setActiveViewId(view.id);
    setFilterStatus(view.filters.status || '');
    setFilterType(view.filters.type || '');
    setSearchName(view.filters.q || '');
    setPage(1);
  }

  function handleSaveCurrentView() {
    const name = window.prompt('Nombre de la vista:');
    if (!name?.trim()) return;
    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      icon: '⭐',
      filters: {
        ...(filterStatus && { status: filterStatus }),
        ...(filterType && { type: filterType }),
        ...(searchName && { q: searchName }),
      },
    };
    saveView('resources', newView);
    setSavedViews((prev) => [...prev, newView]);
    setActiveViewId(newView.id);
  }

  async function handleDeleteView(viewId: string, name: string) {
    const ok = await confirm({
      title: `Eliminar la vista "${name}"?`,
      message: 'Esta accion no se puede deshacer. Solo afecta a tus vistas guardadas locales.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    deleteView('resources', viewId);
    setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
    if (activeViewId === viewId) setActiveViewId('all');
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const loadResources = useCallback(() => {
    const params: Record<string, string> = { page: String(page), limit: '20' };
    if (filterType) params.type = filterType;
    if (filterStatus) params.status = filterStatus;
    if (filterMunicipio) params.municipio = filterMunicipio;
    // F3: include the zona filter when present so the public api restricts
    // the result set server-side. Receives a zona UUID.
    if (zonaFilterId) params.zona = zonaFilterId;

    api.getResources(params)
      .then(setResources)
      .catch((err) => setError(err.message));
  }, [page, filterType, filterStatus, filterMunicipio, zonaFilterId]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  useEffect(() => {
    api.getTypologies().then(setTypologies).catch(() => {});
    api.getMunicipalities().then(setMunicipalities).catch(() => {});
    // F3: cached fetch — used to render the zone NAME in the active filter
    // badge instead of an opaque UUID. Cheap because api.getZones() is in
    // the 5-min in-memory cache (Tanda 2).
    api.getZones().then(setZones).catch(() => {});
  }, []);

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `Eliminar "${name}"?`,
      message: 'Esta accion no se puede deshacer. Se eliminaran tambien todas las imagenes, documentos y traducciones asociadas.',
      confirmLabel: 'Eliminar recurso',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.deleteResource(id);
      loadResources();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const label = STATUS_LABELS[newStatus] || newStatus;
    const ok = await confirm({
      title: `Cambiar estado a "${label}"?`,
      message: newStatus === 'publicado'
        ? 'El recurso sera visible para todos los visitantes del portal publico.'
        : `El estado del recurso pasara a "${label}".`,
      confirmLabel: 'Cambiar estado',
      variant: newStatus === 'publicado' ? 'default' : newStatus === 'archivado' ? 'warning' : 'default',
    });
    if (!ok) return;
    const resource = resources?.items.find((r) => r.id === id);
    const resourceName = resource?.name?.es || resource?.slug || 'Recurso';
    setBusyId(id);
    try {
      await api.updateResourceStatus(id, newStatus);
      // Notify on successful status change
      if (newStatus === 'publicado') {
        notify({
          type: 'success',
          title: 'Recurso publicado',
          message: `"${resourceName}" ya esta visible en el portal publico.`,
          link: `/resources/${id}`,
        });
      } else if (newStatus === 'archivado') {
        notify({
          type: 'warning',
          title: 'Recurso archivado',
          message: `"${resourceName}" ya no aparece en el portal.`,
          link: `/resources/${id}`,
        });
      } else if (newStatus === 'revision') {
        notify({
          type: 'info',
          title: 'Enviado a revision',
          message: `"${resourceName}" pendiente de aprobacion.`,
          link: `/resources/${id}`,
        });
      }
      loadResources();
    } catch (err: unknown) {
      const msg = (err as Error).message;
      setError(msg);
      notify({
        type: 'error',
        title: 'Error al cambiar estado',
        message: msg,
      });
    } finally {
      setBusyId(null);
    }
  }

  // Mapas de etiquetas para mostrar nombres en español en vez de códigos
  // técnicos (TouristAttraction → "Atracción turística", etc.). Datos
  // vienen de la edge function /typologies y /municipalities (ya cacheados
  // 5 min en api.ts).
  const typologyLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of typologies) m[t.typeCode] = t.name?.es || t.typeCode;
    return m;
  }, [typologies]);

  const municipioLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mu of municipalities) m[mu.id] = mu.name?.es || mu.slug;
    return m;
  }, [municipalities]);

  // Click fuera del menú "⋯" para cerrarlo. Solo activo cuando hay un menú abierto.
  useEffect(() => {
    if (!openMenuId) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-menu')) setOpenMenuId(null);
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  const filtered = useMemo(() => {
    if (!resources) return [];
    const q = searchName.toLowerCase().trim();
    if (!q) return resources.items;
    return resources.items.filter((r) =>
      (r.name?.es || '').toLowerCase().includes(q) ||
      (r.name?.gl || '').toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q)
    );
  }, [resources, searchName]);

  const visibleAllSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  function toggleSelectAllVisible() {
    const visibleIds = filtered.map((r) => r.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (visibleAllSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Recursos turisticos</h1>
        <button className="btn btn-primary" onClick={() => navigate('/resources/new')}>
          + Nuevo recurso
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Saved views — tabs */}
      <div className="saved-views">
        {allViews.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`saved-view ${activeViewId === v.id ? 'saved-view--active' : ''}`}
            onClick={() => applyView(v)}
          >
            {v.icon && <span className="saved-view__icon">{v.icon}</span>}
            <span>{v.name}</span>
            {!v.builtin && (
              <span
                className="saved-view__delete"
                onClick={(e) => { e.stopPropagation(); handleDeleteView(v.id, v.name); }}
                role="button"
                aria-label={`Eliminar vista ${v.name}`}
              >×</span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="saved-view saved-view--add"
          onClick={handleSaveCurrentView}
          title="Guardar la combinacion actual de filtros como nueva vista"
        >
          + Guardar vista
        </button>
      </div>

      {/* F3: active zona filter banner — visible when navigating from
          /zones, with the zone name and a clear button. */}
      {zonaFilterId && (
        <div
          className="alert alert-info"
          role="status"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}
        >
          <span>
            🏷️ Filtrando por zona:{' '}
            <strong>
              {zonaFilterItem
                ? (zonaFilterItem.name?.es || zonaFilterItem.name?.gl || zonaFilterItem.slug)
                : 'cargando…'}
            </strong>
            {' · '}
            <Link to="/zones" style={{ fontSize: '0.85rem' }}>← Volver a zonas</Link>
          </span>
          <button type="button" className="btn btn-sm" onClick={clearZonaFilter}>
            Quitar filtro
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="search"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Buscar por nombre..."
          className="quick-search__input"
          aria-label="Buscar por nombre"
          style={{ minWidth: '180px' }}
        />
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">Todas las tipologias</option>
          {typologies.map((t) => (
            <option key={t.typeCode} value={t.typeCode}>
              {t.name?.es || t.typeCode} ({t.grupo})
            </option>
          ))}
        </select>

        <select
          value={filterMunicipio}
          onChange={(e) => { setFilterMunicipio(e.target.value); setPage(1); }}
          aria-label="Filtrar por municipio"
        >
          <option value="">Todos los municipios</option>
          {municipalities.map((m) => (
            <option key={m.id} value={m.id}>{m.name?.es || m.slug}</option>
          ))}
        </select>
        {/* El select redundante "Todos los estados" se sustituye por los tabs
            de saved-views arriba (Todos / Publicados / Revisión / Borradores /
            Archivados). filterStatus ahora se controla desde esos tabs. */}
      </div>

      {!resources && !error && <SkeletonTable rows={6} />}

      {resources && (
        <>
          <p className="results-count">
            {searchName.trim() ? `${filtered.length} de ` : ''}{resources.total} recursos encontrados (pagina {resources.page} de {resources.pages})
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}>
                  <input
                    type="checkbox"
                    checked={visibleAllSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Seleccionar todos los visibles"
                  />
                </th>
                <th>Nombre</th>
                <th>Tipologia</th>
                <th>Estado</th>
                <th>Actualizado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState
                    variant="inline"
                    icon="🏖️"
                    title={searchName || filterType || filterStatus ? 'Sin resultados' : 'Aun no hay recursos turisticos'}
                    description={searchName || filterType || filterStatus
                      ? 'Prueba a quitar algun filtro o cambiar la busqueda.'
                      : 'Crea tu primer recurso con el asistente paso a paso. Te guiamos para que sea perfecto.'}
                    action={!searchName && !filterType && !filterStatus
                      ? { label: '+ Crear el primer recurso', onClick: () => navigate('/resources/new') }
                      : undefined}
                  />
                </td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className={selectedIds.has(r.id) ? 'data-table__row--selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelected(r.id)}
                      aria-label={`Seleccionar ${r.name?.es || r.slug}`}
                    />
                  </td>
                  <td>
                    <strong>{r.name?.es || r.name?.gl || r.slug}</strong>
                    <br />
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>
                      {r.municipioId && municipioLabel[r.municipioId]
                        ? `${municipioLabel[r.municipioId]} · ${r.slug}`
                        : r.slug}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`tipo-badge tipo-badge--${TIPO_GRUPO[r.rdfType] || 'general'}`}
                      title={r.rdfType}
                    >
                      {typologyLabel[r.rdfType] || r.rdfType}
                    </span>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ background: STATUS_COLORS[r.status] || '#999' }}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('es') : '-'}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm" onClick={() => navigate(`/resources/${r.id}`)} disabled={busyId === r.id}>
                        Editar
                      </button>
                      <div className="action-menu">
                        <button
                          type="button"
                          className="btn btn-sm btn-icon"
                          aria-label="Mas acciones"
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === r.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === r.id ? null : r.id);
                          }}
                          disabled={busyId === r.id}
                        >
                          ⋯
                        </button>
                        {openMenuId === r.id && (
                          <div className="action-menu__dropdown" role="menu">
                            <button
                              type="button"
                              className="action-menu__item"
                              onClick={() => {
                                setOpenMenuId(null);
                                setQrResource({ slug: r.slug, name: r.name?.es || r.name?.gl || r.slug });
                              }}
                            >
                              Ver QR
                            </button>
                            {(STATE_TRANSITIONS[r.status] || []).map((t) => (
                              <button
                                key={t.target}
                                type="button"
                                className={`action-menu__item${t.style === 'btn-danger' ? ' action-menu__item--warning' : ''}`}
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleStatusChange(r.id, t.target);
                                }}
                                disabled={busyId === r.id}
                              >
                                {t.label}
                              </button>
                            ))}
                            <div className="action-menu__separator" />
                            <button
                              type="button"
                              className="action-menu__item action-menu__item--danger"
                              onClick={() => {
                                setOpenMenuId(null);
                                handleDelete(r.id, r.name?.es || r.slug);
                              }}
                              disabled={busyId === r.id}
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {resources.pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Pagina {page} de {resources.pages}</span>
              <button disabled={page >= resources.pages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
      {qrResource && (
        <QrModal slug={qrResource.slug} name={qrResource.name} onClose={() => setQrResource(null)} />
      )}

      {/* Floating selection bar — visible when there are selected resources */}
      {selectedIds.size > 0 && (
        <div className="bulk-selection-bar">
          <span className="bulk-selection-bar__count">
            <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'recurso seleccionado' : 'recursos seleccionados'}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setBulkOpen(true)}
          >
            ✨ Acciones IA en lote
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={clearSelection}
          >
            Deseleccionar
          </button>
        </div>
      )}

      {bulkOpen && (
        <BulkAiActions
          selectedIds={Array.from(selectedIds)}
          onClose={() => setBulkOpen(false)}
          onComplete={() => {
            clearSelection();
            loadResources();
          }}
        />
      )}
    </div>
  );
}
