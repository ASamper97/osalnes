import { useCallback, useEffect, useState } from 'react';
import { api, type ZoneItem, type MunicipalityItem } from './api';

/**
 * useZones — shared data layer for ZonesMapPage and ZonesPage.
 *
 * Both pages used to duplicate `load()`, `handleSubmit()`, `handleDelete()`
 * and the loading/error state machinery (audit finding A8). This hook owns
 * all of that so the page components only handle UI concerns.
 *
 * The hook does NOT touch React Router or the confirm dialog — those are
 * UI-specific and stay in the page component.
 */

export interface ZoneFormPayload {
  slug: string;
  municipio_id: string;
  /** Multilingual name. Empty values clear the corresponding translation. */
  name: Record<string, string>;
}

export interface UseZonesResult {
  zones: ZoneItem[];
  municipalities: MunicipalityItem[];
  loading: boolean;
  error: string | null;
  /** Set the error from the page (e.g. validation messages). */
  setError: (msg: string | null) => void;
  /** Force a refetch of zones + municipalities. */
  refresh: () => Promise<void>;
  /** Create a zone. Returns true on success, false otherwise. */
  create: (payload: ZoneFormPayload) => Promise<boolean>;
  /** Update an existing zone. Returns true on success. */
  update: (id: string, payload: ZoneFormPayload) => Promise<boolean>;
  /** Delete a zone. Returns the affected resources count, or null on error. */
  remove: (id: string) => Promise<number | null>;
  /** True while a single-row mutation is in flight. */
  busyId: string | null;
}

export function useZones(): UseZonesResult {
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [z, m] = await Promise.all([api.getZones(), api.getMunicipalities()]);
      setZones(z);
      setMunicipalities(m);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (payload: ZoneFormPayload): Promise<boolean> => {
    setError(null);
    try {
      await api.createZone(payload);
      await refresh();
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    }
  }, [refresh]);

  const update = useCallback(async (id: string, payload: ZoneFormPayload): Promise<boolean> => {
    setError(null);
    try {
      await api.updateZone(id, payload);
      await refresh();
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    }
  }, [refresh]);

  const remove = useCallback(async (id: string): Promise<number | null> => {
    setError(null);
    setBusyId(id);
    try {
      // The admin endpoint returns { ok, affectedResources }. The api.ts
      // typing currently returns `{ ok: boolean }`, so we cast for the
      // additional field. Refresh after to pick up the cascade.
      const result = await api.deleteZone(id) as { ok: boolean; affectedResources?: number };
      await refresh();
      return result.affectedResources ?? 0;
    } catch (err: unknown) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  return {
    zones,
    municipalities,
    loading,
    error,
    setError,
    refresh,
    create,
    update,
    remove,
    busyId,
  };
}
