/**
 * useExportJobDetail — hook del drawer de detalle de un job SCR-13 Fase B
 *
 * Gestiona:
 *   · Carga del detalle del job + records
 *   · Auto-refresh si el job está running/pending
 *   · Fetch lazy del payload individual (al abrir el tab)
 *   · Descargas (payload bundle + log texto)
 *   · Reintento con modo total/solo-fallidos
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ExportJobDetail,
  type ExportJobRecord,
  type RetryMode,
  buildDownloadFilename,
  downloadAsFile,
  mapRpcExportJobDetail,
  mapRpcExportJobRecord,
} from '@osalnes/shared/data/exports-detail';

const ACTIVE_REFRESH_MS = 3_000;

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

export interface UseExportJobDetailOptions {
  supabase: SupabaseLike;
  jobId: string | null;
  /** Si el usuario es admin (decisión B3-C · log completo vs sanitizado) */
  isAdmin: boolean;
}

export interface UseExportJobDetailState {
  detail: ExportJobDetail | null;
  records: ExportJobRecord[];
  recordsFilter: 'all' | 'failed' | 'success';
  setRecordsFilter: (f: 'all' | 'failed' | 'success') => void;
  loading: boolean;
  error: string | null;

  refetch: () => Promise<void>;

  /** Descarga el bundle JSON agregado (decisión B2-C) */
  downloadPayloadBundle: () => Promise<void>;

  /** Descarga el log texto plano (sanitizado por defecto · B3-C) */
  downloadLog: (mode: 'sanitized' | 'full') => Promise<void>;

  /** Fetch individual del payload de un record (tab Payload) */
  getRecordPayload: (recordId: string) => Promise<unknown>;

  /** Reintento · crea un nuevo job */
  retry: (mode: RetryMode) => Promise<string>;

  downloading: boolean;
  retrying: boolean;
}

export function useExportJobDetail({
  supabase,
  jobId,
  isAdmin,
}: UseExportJobDetailOptions): UseExportJobDetailState {
  const [detail, setDetail] = useState<ExportJobDetail | null>(null);
  const [records, setRecords] = useState<ExportJobRecord[]>([]);
  const [recordsFilter, setRecordsFilter] = useState<'all' | 'failed' | 'success'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchIdRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!jobId) {
      setDetail(null);
      setRecords([]);
      return;
    }
    const myId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const [detailRes, recordsRes] = await Promise.all([
        supabase.rpc('exports_get_detail', { p_job_id: jobId }),
        supabase.rpc('exports_get_records', {
          p_job_id: jobId,
          p_status: recordsFilter === 'all' ? null : recordsFilter,
          p_page: 1,
          p_page_size: 100,
        }),
      ]);

      if (myId !== fetchIdRef.current) return;

      if (detailRes.error) throw new Error(detailRes.error.message);
      if (recordsRes.error) throw new Error(recordsRes.error.message);

      const detailRow = Array.isArray(detailRes.data) && detailRes.data.length > 0
        ? (detailRes.data[0] as Record<string, unknown>)
        : null;
      setDetail(detailRow ? mapRpcExportJobDetail(detailRow) : null);

      const recordsList = Array.isArray(recordsRes.data)
        ? (recordsRes.data as Record<string, unknown>[])
        : [];
      setRecords(recordsList.map(mapRpcExportJobRecord));
    } catch (e) {
      if (myId === fetchIdRef.current) {
        setError(e instanceof Error ? e.message : 'Error cargando detalle');
      }
    } finally {
      if (myId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [supabase, jobId, recordsFilter]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Auto-refresh si está activo (3s)
  useEffect(() => {
    if (!detail) return;
    if (detail.status !== 'running' && detail.status !== 'pending') return;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refetch();
      }
    }, ACTIVE_REFRESH_MS);

    return () => clearInterval(timer);
  }, [detail, refetch]);

  const downloadPayloadBundle = useCallback(async () => {
    if (!jobId || !detail) return;
    setDownloading(true);
    try {
      const res = await supabase.rpc('exports_get_payload_bundle', { p_job_id: jobId });
      if (res.error) throw new Error(res.error.message);
      const bundle = res.data;
      const filename = buildDownloadFilename({
        jobType: detail.jobType,
        jobId,
        extension: 'json',
        startedAt: detail.startedAt,
      });
      downloadAsFile(
        JSON.stringify(bundle, null, 2),
        filename,
        'application/json',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error descargando el bundle');
    } finally {
      setDownloading(false);
    }
  }, [supabase, jobId, detail]);

  const downloadLog = useCallback(
    async (mode: 'sanitized' | 'full') => {
      if (!jobId || !detail) return;
      // Protección UI (el backend también respeta permisos)
      if (mode === 'full' && !isAdmin) {
        setError('El log completo solo está disponible para administradores.');
        return;
      }
      setDownloading(true);
      try {
        const res = await supabase.rpc('exports_get_log_text', {
          p_job_id: jobId,
          p_sanitized: mode === 'sanitized',
        });
        if (res.error) throw new Error(res.error.message);
        const logText = typeof res.data === 'string' ? res.data : String(res.data);
        const filename = buildDownloadFilename({
          jobType: detail.jobType,
          jobId,
          extension: 'txt',
          startedAt: detail.startedAt,
        });
        downloadAsFile(logText, filename, 'text/plain;charset=utf-8');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error descargando el log');
      } finally {
        setDownloading(false);
      }
    },
    [supabase, jobId, detail, isAdmin],
  );

  const getRecordPayload = useCallback(
    async (recordId: string): Promise<unknown> => {
      const res = await supabase.rpc('exports_get_record_payload', {
        p_record_id: recordId,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    [supabase],
  );

  const retry = useCallback<UseExportJobDetailState['retry']>(
    async (mode) => {
      if (!jobId) throw new Error('Sin job seleccionado');
      setRetrying(true);
      setError(null);
      try {
        const res = await supabase.rpc('exports_retry', {
          p_job_id: jobId,
          p_mode: mode,
        });
        if (res.error) throw new Error(res.error.message);
        const newJobId = String(res.data ?? '');

        // Disparar la edge function para que procese el nuevo job inmediatamente
        if (newJobId && supabase.functions) {
          try {
            await supabase.functions.invoke('export-worker', {
              body: { job_id: newJobId },
            });
          } catch {
            // Si la edge function falla el job queda pending
          }
        }
        return newJobId;
      } finally {
        setRetrying(false);
      }
    },
    [supabase, jobId],
  );

  return {
    detail,
    records,
    recordsFilter,
    setRecordsFilter,
    loading,
    error,
    refetch,
    downloadPayloadBundle,
    downloadLog,
    getRecordPayload,
    retry,
    downloading,
    retrying,
  };
}
