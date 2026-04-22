/**
 * useRelations — carga y mutación de relaciones de un recurso
 */

import { useCallback, useEffect, useState } from 'react';
import {
  type ResourceRelation,
  type RelationPredicate,
  type RelationSearchResult,
  mapRpcRelation,
  mapRpcSearchResult,
} from '@osalnes/shared/data/resource-relations';

export interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface UseRelationsOptions {
  supabase: SupabaseLike;
  resourceId: string | null;
}

export interface UseRelationsState {
  relations: ResourceRelation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  createRelation: (params: {
    targetId: string;
    predicate: RelationPredicate;
    note?: string | null;
  }) => Promise<string>;

  deleteRelation: (id: string) => Promise<void>;

  search: (params: {
    query: string;
    typeFilter?: string | null;
    municipalityFilter?: string | null;
    statusFilter?: string | null;
  }) => Promise<RelationSearchResult[]>;
}

export function useRelations({
  supabase,
  resourceId,
}: UseRelationsOptions): UseRelationsState {
  const [relations, setRelations] = useState<ResourceRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!resourceId) {
      setRelations([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await supabase.rpc('list_relations_for_resource', {
        p_resource_id: resourceId,
      });
      if (res.error) throw new Error(res.error.message);
      const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
      setRelations(rows.map(mapRpcRelation));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando relaciones');
    } finally {
      setLoading(false);
    }
  }, [supabase, resourceId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createRelation = useCallback(
    async ({
      targetId,
      predicate,
      note = null,
    }: {
      targetId: string;
      predicate: RelationPredicate;
      note?: string | null;
    }): Promise<string> => {
      if (!resourceId) throw new Error('Debes guardar el recurso antes de crear relaciones');
      const res = await supabase.rpc('create_relation', {
        p_source_id: resourceId,
        p_target_id: targetId,
        p_predicate: predicate,
        p_note: note,
      });
      if (res.error) throw new Error(res.error.message);
      await refetch();
      return String(res.data ?? '');
    },
    [supabase, resourceId, refetch],
  );

  const deleteRelation = useCallback(
    async (id: string): Promise<void> => {
      const res = await supabase.rpc('delete_relation', { p_relation_id: id });
      if (res.error) throw new Error(res.error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const search = useCallback(
    async ({
      query,
      typeFilter = null,
      municipalityFilter = null,
      statusFilter = null,
    }: {
      query: string;
      typeFilter?: string | null;
      municipalityFilter?: string | null;
      statusFilter?: string | null;
    }): Promise<RelationSearchResult[]> => {
      if (!resourceId) return [];
      const res = await supabase.rpc('search_resources_for_relation', {
        p_query: query,
        p_exclude_id: resourceId,
        p_type_filter: typeFilter,
        p_municipality_filter: municipalityFilter,
        p_status_filter: statusFilter,
        p_limit: 15,
      });
      if (res.error) throw new Error(res.error.message);
      const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
      return rows.map(mapRpcSearchResult);
    },
    [supabase, resourceId],
  );

  return {
    relations,
    loading,
    error,
    refetch,
    createRelation,
    deleteRelation,
    search,
  };
}
