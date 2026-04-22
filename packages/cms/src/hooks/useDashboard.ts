/**
 * useDashboard — hook principal del Dashboard operativo
 *
 * Carga en paralelo:
 *   - overview (KPIs + alertas)
 *   - myWork (borradores del usuario)
 *   - upcomingScheduled (próximas publicaciones)
 *   - recentActivity (audit_log o updated_at)
 *   - translationProgress (por idioma)
 *   - uneIndicators (5 indicadores)
 *
 * Refresco automático cada 60s (decisión 7-A) sin pestaña
 * parpadeante — si el refresh está en curso cuando llega el timer, se
 * salta la siguiente iteración.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_OVERVIEW,
  EMPTY_UNE_INDICATORS,
  mapRpcActivityRow,
  mapRpcMyWorkRow,
  mapRpcOverview,
  mapRpcScheduledRow,
  mapRpcTranslationRow,
  mapRpcUneIndicators,
  type ActivityRow,
  type DashboardOverview,
  type MyWorkRow,
  type ScheduledRow,
  type TranslationProgressRow,
  type UneIndicators,
} from '@osalnes/shared/data/dashboard';

const REFRESH_INTERVAL_MS = 60_000;

export interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface UseDashboardOptions {
  supabase: SupabaseLike;
  /** Auto-refresh activo (solo si la pestaña está visible) */
  autoRefresh?: boolean;
}

export interface UseDashboardState {
  overview: DashboardOverview;
  myWork: MyWorkRow[];
  upcomingScheduled: ScheduledRow[];
  recentActivity: ActivityRow[];
  translationProgress: TranslationProgressRow[];
  uneIndicators: UneIndicators;

  loading: boolean;
  /** true solo la primera vez. Los refreshes posteriores no muestran loading */
  initialLoading: boolean;
  error: string | null;
  lastRefreshedAt: Date | null;
  refetch: () => Promise<void>;
}

export function useDashboard({
  supabase,
  autoRefresh = true,
}: UseDashboardOptions): UseDashboardState {
  const [overview, setOverview] = useState<DashboardOverview>(EMPTY_OVERVIEW);
  const [myWork, setMyWork] = useState<MyWorkRow[]>([]);
  const [upcomingScheduled, setUpcomingScheduled] = useState<ScheduledRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([]);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgressRow[]>([]);
  const [uneIndicators, setUneIndicators] = useState<UneIndicators>(EMPTY_UNE_INDICATORS);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const inFlightRef = useRef(false);
  const fetchIdRef = useRef(0);

  const fetchAll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const myId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const [
        overviewRes,
        myWorkRes,
        scheduledRes,
        activityRes,
        translationRes,
        uneRes,
      ] = await Promise.all([
        supabase.rpc('dashboard_get_overview', {}),
        supabase.rpc('dashboard_get_my_work', { p_limit: 6 }),
        supabase.rpc('dashboard_get_upcoming_scheduled', { p_limit: 5 }),
        supabase.rpc('dashboard_get_recent_activity', { p_limit: 10, p_only_mine: false }),
        supabase.rpc('dashboard_get_translation_progress', {}),
        supabase.rpc('dashboard_get_une_indicators', {}),
      ]);

      if (myId !== fetchIdRef.current) return; // descartar si hay otro en curso

      const errors = [overviewRes, myWorkRes, scheduledRes, activityRes, translationRes, uneRes]
        .map((r) => r.error?.message)
        .filter((m): m is string => !!m);
      if (errors.length > 0) throw new Error(errors[0]);

      // Overview devuelve una sola fila
      const overviewRow = Array.isArray(overviewRes.data) && overviewRes.data.length > 0
        ? overviewRes.data[0] as Record<string, unknown>
        : {};
      setOverview(mapRpcOverview(overviewRow));

      setMyWork(
        (Array.isArray(myWorkRes.data) ? myWorkRes.data : [])
          .map((r) => mapRpcMyWorkRow(r as Record<string, unknown>)),
      );
      setUpcomingScheduled(
        (Array.isArray(scheduledRes.data) ? scheduledRes.data : [])
          .map((r) => mapRpcScheduledRow(r as Record<string, unknown>)),
      );
      setRecentActivity(
        (Array.isArray(activityRes.data) ? activityRes.data : [])
          .map((r) => mapRpcActivityRow(r as Record<string, unknown>)),
      );
      setTranslationProgress(
        (Array.isArray(translationRes.data) ? translationRes.data : [])
          .map((r) => mapRpcTranslationRow(r as Record<string, unknown>)),
      );

      const uneRow = Array.isArray(uneRes.data) && uneRes.data.length > 0
        ? uneRes.data[0] as Record<string, unknown>
        : {};
      setUneIndicators(mapRpcUneIndicators(uneRow));

      setLastRefreshedAt(new Date());
    } catch (e) {
      if (myId !== fetchIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Error cargando el dashboard');
    } finally {
      if (myId === fetchIdRef.current) {
        setLoading(false);
        setInitialLoading(false);
      }
      inFlightRef.current = false;
    }
  }, [supabase]);

  // Carga inicial
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Auto-refresh cada 60s solo si la pestaña está visible
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchAll();
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll]);

  return {
    overview,
    myWork,
    upcomingScheduled,
    recentActivity,
    translationProgress,
    uneIndicators,
    loading,
    initialLoading,
    error,
    lastRefreshedAt,
    refetch: fetchAll,
  };
}
