/**
 * useTaxonomies — gestor unificado de catálogos SCR-10
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type TaxonomyCatalog,
  type TaxonomyTerm,
  type TaxonomyTermDetail,
  type UsageItem,
  emptyTaxonomyDetail,
  mapRpcTaxonomyDetail,
  mapRpcTaxonomyTerm,
  mapRpcUsageItem,
} from '@osalnes/shared/data/taxonomies';

export interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface UseTaxonomiesOptions {
  supabase: SupabaseLike;
  initialCatalog?: TaxonomyCatalog;
  initialLang?: string;
}

export interface UseTaxonomiesState {
  catalog: TaxonomyCatalog;
  setCatalog: (c: TaxonomyCatalog) => void;

  lang: string;
  setLang: (l: string) => void;

  includeInactive: boolean;
  setIncludeInactive: (b: boolean) => void;

  terms: TaxonomyTerm[];
  loading: boolean;
  error: string | null;

  refetch: () => Promise<void>;

  /** Cargar detalle (para el editor) */
  getDetail: (id: string | null) => Promise<TaxonomyTermDetail>;

  /** Crear/editar */
  upsert: (params: {
    id?: string | null;
    slug: string;
    parentId?: string | null;
    semanticUri?: string | null;
    schemaCode?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    nameEs?: string; nameGl?: string; nameEn?: string;
    descriptionEs?: string; descriptionGl?: string; descriptionEn?: string;
  }) => Promise<string>;

  /** Soft delete · decisión 6-C */
  toggleActive: (id: string, isActive: boolean) => Promise<void>;

  /** Ver uso · decisión 5-B */
  getUsage: (id: string) => Promise<UsageItem[]>;
}

export function useTaxonomies({
  supabase,
  initialCatalog = 'municipio',
  initialLang = 'es',
}: UseTaxonomiesOptions): UseTaxonomiesState {
  const [catalog, setCatalog] = useState<TaxonomyCatalog>(initialCatalog);
  const [lang, setLang] = useState<string>(initialLang);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const myId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await supabase.rpc('taxonomy_list', {
        p_catalog: catalog,
        p_include_inactive: includeInactive,
        p_parent_id: null,
        p_lang: lang,
      });
      if (myId !== fetchIdRef.current) return;
      if (res.error) throw new Error(res.error.message);
      const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
      setTerms(rows.map(mapRpcTaxonomyTerm));
    } catch (e) {
      if (myId === fetchIdRef.current) {
        setError(e instanceof Error ? e.message : 'Error cargando catálogo');
      }
    } finally {
      if (myId === fetchIdRef.current) setLoading(false);
    }
  }, [supabase, catalog, includeInactive, lang]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const getDetail = useCallback(
    async (id: string | null): Promise<TaxonomyTermDetail> => {
      if (!id) return emptyTaxonomyDetail();
      const res = await supabase.rpc('taxonomy_get', {
        p_catalog: catalog,
        p_id: id,
      });
      if (res.error) throw new Error(res.error.message);
      const row = Array.isArray(res.data) && res.data.length > 0
        ? (res.data[0] as Record<string, unknown>)
        : null;
      return row ? mapRpcTaxonomyDetail(row) : emptyTaxonomyDetail();
    },
    [supabase, catalog],
  );

  const upsert = useCallback<UseTaxonomiesState['upsert']>(
    async (params) => {
      const res = await supabase.rpc('taxonomy_upsert', {
        p_catalog: catalog,
        p_id: params.id ?? null,
        p_slug: params.slug,
        p_parent_id: params.parentId ?? null,
        p_semantic_uri: params.semanticUri ?? null,
        p_schema_code: params.schemaCode ?? null,
        p_sort_order: params.sortOrder ?? 0,
        p_is_active: params.isActive ?? true,
        p_name_es: params.nameEs ?? null,
        p_name_gl: params.nameGl ?? null,
        p_name_en: params.nameEn ?? null,
        p_description_es: params.descriptionEs ?? null,
        p_description_gl: params.descriptionGl ?? null,
        p_description_en: params.descriptionEn ?? null,
      });
      if (res.error) throw new Error(res.error.message);
      await refetch();
      return String(res.data ?? '');
    },
    [supabase, catalog, refetch],
  );

  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<void> => {
      const res = await supabase.rpc('taxonomy_toggle_active', {
        p_catalog: catalog,
        p_id: id,
        p_is_active: isActive,
      });
      if (res.error) throw new Error(res.error.message);
      await refetch();
    },
    [supabase, catalog, refetch],
  );

  const getUsage = useCallback(
    async (id: string): Promise<UsageItem[]> => {
      const res = await supabase.rpc('taxonomy_get_usage', {
        p_catalog: catalog,
        p_id: id,
      });
      if (res.error) throw new Error(res.error.message);
      const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
      return rows.map(mapRpcUsageItem);
    },
    [supabase, catalog],
  );

  return {
    catalog, setCatalog,
    lang, setLang,
    includeInactive, setIncludeInactive,
    terms, loading, error,
    refetch,
    getDetail, upsert, toggleActive, getUsage,
  };
}
