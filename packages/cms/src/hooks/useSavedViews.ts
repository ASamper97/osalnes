/**
 * useSavedViews — gestión de vistas guardadas por usuario
 *
 * Carga las vistas al montar, expone CRUD contra las RPCs:
 *   - list_saved_views
 *   - upsert_saved_view
 *   - delete_saved_view
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  SavedView,
} from '@osalnes/shared/data/resources-list-b';
import { mapRpcSavedView } from '@osalnes/shared/data/resources-list-b';
import type { ListFilters, ListSort } from '@osalnes/shared/data/resources-list';

export interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface UseSavedViewsOptions {
  supabase: SupabaseLike;
  enabled: boolean;
}

export interface UseSavedViewsState {
  views: SavedView[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  saveView: (params: SaveViewParams) => Promise<string>;
  deleteView: (id: string) => Promise<void>;

  defaultView: SavedView | null;
}

export interface SaveViewParams {
  name: string;
  filters: ListFilters;
  sort?: ListSort | null;
  pageSize?: number | null;
  isDefault?: boolean;
}

export function useSavedViews({
  supabase,
  enabled,
}: UseSavedViewsOptions): UseSavedViewsState {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await supabase.rpc('list_saved_views', {});
      if (res.error) throw new Error(res.error.message);
      const list = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
      setViews(list.map(mapRpcSavedView));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando vistas');
    } finally {
      setLoading(false);
    }
  }, [enabled, supabase]);

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, refetch]);

  const saveView = useCallback(
    async ({ name, filters, sort, pageSize, isDefault = false }: SaveViewParams): Promise<string> => {
      const res = await supabase.rpc('upsert_saved_view', {
        p_name: name,
        p_filters: filters,
        p_sort_order_by: sort?.orderBy ?? null,
        p_sort_order_dir: sort?.orderDir ?? null,
        p_page_size: pageSize ?? null,
        p_is_default: isDefault,
      });
      if (res.error) throw new Error(res.error.message);
      await refetch();
      return String(res.data ?? '');
    },
    [supabase, refetch],
  );

  const deleteView = useCallback(
    async (id: string): Promise<void> => {
      const res = await supabase.rpc('delete_saved_view', { p_view_id: id });
      if (res.error) throw new Error(res.error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const defaultView = views.find((v) => v.isDefault) ?? null;

  return {
    views,
    loading,
    error,
    refetch,
    saveView,
    deleteView,
    defaultView,
  };
}
