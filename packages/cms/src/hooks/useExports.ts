/**
 * useExports — hook principal del Centro de exportaciones
 *
 * Gestiona:
 *   - Listado de jobs con filtros + paginación
 *   - KPIs agregados
 *   - Auto-refresh cada 5s mientras haya jobs running o pending
 *     (frecuencia más alta que el dashboard porque los jobs evolucionan rápido)
 *   - Lanzar pre-validación y nuevo job
 *
 * Invoca la Edge Function `export-worker` tras crear un job para que
 * se procese asíncronamente.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_EXPORTS_KPIS,
  EMPTY_VALIDATION,
  type ExportJobRow,
  type ExportJobType,
  type ExportScopeType,
  type ExportsKpis,
  type ScopeValidation,
  mapRpcExportJobRow,
  mapRpcExportsKpis,
  mapRpcValidation,
} from '@osalnes/shared/data/exports';

const RUNNING_REFRESH_MS = 5_000;
const IDLE_REFRESH_MS = 60_000;

export interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  functions?: {
    invoke: (
      name: string,
      opts?: { body?: Record<string, unknown> },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
}

// ─── Filtros del listado ──────────────────────────────────────────────

export interface ExportsFilters {
  status: string; // '' | 'pending' | 'running' | 'success' | 'partial' | 'failed'
  jobType: string; // '' | 'pid' | 'data_lake' | 'csv' | 'json_ld'
  dateFrom: string | null; // ISO
  dateTo: string | null;
  onlyMine: boolean;
}

export const EMPTY_FILTERS: ExportsFilters = {
  status: '',
  jobType: '',
  dateFrom: null,
  dateTo: null,
  onlyMine: false,
};

// ─── Estado del hook ──────────────────────────────────────────────────

export interface UseExportsState {
  rows: ExportJobRow[];
  kpis: ExportsKpis;
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  totalCount: number;
  page: number;
  pageSize: number;

  filters: ExportsFilters;
  setFilters: (f: Partial<ExportsFilters>) => void;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;

  refetch: () => Promise<void>;

  /** Pre-validación antes de crear job (decisión 4-A) */
  validateScope: (params: {
    jobType: ExportJobType;
    scopeType: ExportScopeType;
    scopeFilter?: Record<string, unknown> | null;
    scopeIds?: string[] | null;
  }) => Promise<ScopeValidation>;

  /** Lanzar nuevo job y pedir a la edge function que lo procese */
  launch: (params: {
    jobType: ExportJobType;
    scopeType: ExportScopeType;
    scopeFilter?: Record<string, unknown> | null;
    scopeIds?: string[] | null;
    notes?: string | null;
  }) => Promise<string>;
}

export interface UseExportsOptions {
  supabase: SupabaseLike;
  initialPageSize?: number;
}

export function useExports({
  supabase,
  initialPageSize = 25,
}: UseExportsOptions): UseExportsState {
  const [rows, setRows] = useState<ExportJobRow[]>([]);
  const [kpis, setKpis] = useState<ExportsKpis>(EMPTY_EXPORTS_KPIS);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [filters, setFiltersState] = useState<ExportsFilters>(EMPTY_FILTERS);

  const inFlightRef = useRef(false);
  const fetchIdRef = useRef(0);

  const setFilters = useCallback((f: Partial<ExportsFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
    setPage(1);
  }, []);

  const setPageSize = useCallback((n: number) => {
    setPageSizeState(n);
    setPage(1);
  }, []);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const myId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const [listRes, kpisRes] = await Promise.all([
        supabase.rpc('exports_list', {
          p_status: filters.status || null,
          p_job_type: filters.jobType || null,
          p_date_from: filters.dateFrom,
          p_date_to: filters.dateTo,
          p_only_mine: filters.onlyMine,
          p_page: page,
          p_page_size: pageSize,
        }),
        supabase.rpc('exports_get_kpis', {}),
      ]);

      if (myId !== fetchIdRef.current) return;

      if (listRes.error) throw new Error(listRes.error.message);
      if (kpisRes.error) throw new Error(kpisRes.error.message);

      const listData = Array.isArray(listRes.data)
        ? (listRes.data as Record<string, unknown>[])
        : [];
      const mappedRows = listData.map(mapRpcExportJobRow);
      setRows(mappedRows);
      setTotalCount(mappedRows.length > 0 ? mappedRows[0].totalCount : 0);

      const kpisRow = Array.isArray(kpisRes.data) && kpisRes.data.length > 0
        ? (kpisRes.data[0] as Record<string, unknown>)
        : {};
      setKpis(mapRpcExportsKpis(kpisRow));
    } catch (e) {
      if (myId === fetchIdRef.current) {
        setError(e instanceof Error ? e.message : 'Error cargando exportaciones');
      }
    } finally {
      if (myId === fetchIdRef.current) {
        setLoading(false);
        setInitialLoading(false);
      }
      inFlightRef.current = false;
    }
  }, [supabase, filters, page, pageSize]);

  // Carga inicial + cuando cambien filtros/página
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Auto-refresh adaptativo según si hay jobs activos
  useEffect(() => {
    const hasActive = kpis.runningNow > 0 || kpis.pendingNow > 0 ||
      rows.some((r) => r.status === 'pending' || r.status === 'running');
    const interval = hasActive ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refetch();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [kpis.runningNow, kpis.pendingNow, rows, refetch]);

  const validateScope = useCallback<UseExportsState['validateScope']>(
    async ({ jobType, scopeType, scopeFilter, scopeIds }) => {
      const res = await supabase.rpc('exports_validate_scope', {
        p_scope_type: scopeType,
        p_scope_filter: scopeFilter ?? null,
        p_scope_ids: scopeIds ?? null,
        p_job_type: jobType,
      });
      if (res.error) throw new Error(res.error.message);
      const row = Array.isArray(res.data) && res.data.length > 0
        ? (res.data[0] as Record<string, unknown>)
        : {};
      return mapRpcValidation(row);
    },
    [supabase],
  );

  const launch = useCallback<UseExportsState['launch']>(
    async ({ jobType, scopeType, scopeFilter, scopeIds, notes }) => {
      const res = await supabase.rpc('exports_launch', {
        p_job_type: jobType,
        p_scope_type: scopeType,
        p_scope_filter: scopeFilter ?? null,
        p_scope_ids: scopeIds ?? null,
        p_notes: notes ?? null,
      });
      if (res.error) throw new Error(res.error.message);
      const jobId = String(res.data ?? '');

      // Disparar la edge function para procesar inmediatamente
      if (jobId && supabase.functions) {
        try {
          await supabase.functions.invoke('export-worker', { body: { job_id: jobId } });
        } catch {
          // Si la edge function falla, el job se queda pending — el
          // usuario puede reintentar o un cron puede recogerlo.
        }
      }

      await refetch();
      return jobId;
    },
    [supabase, refetch],
  );

  return {
    rows,
    kpis,
    loading,
    initialLoading,
    error,
    totalCount,
    page,
    pageSize,
    filters,
    setFilters,
    setPage,
    setPageSize,
    refetch,
    validateScope,
    launch,
  };
}

export const EMPTY_VALIDATION_EXPORT = EMPTY_VALIDATION; // re-export para uso en componentes
