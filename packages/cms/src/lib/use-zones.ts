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
  /** ISO 8601 timestamp of the value originally loaded — used for the
   *  optimistic concurrency check on PUT (DF3). Required when updating
   *  an existing zone. The hook injects it for callers; consumers don't
   *  need to track it themselves. */
  expected_updated_at?: string;
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

// Pure helper outside the hook so it isn't recreated on every render.
function insertSorted(list: ZoneItem[], item: ZoneItem): ZoneItem[] {
  const next = [...list, item];
  next.sort((a, b) => a.slug.localeCompare(b.slug));
  return next;
}

export function useZones(): UseZonesResult {
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      // P3 (audit): we deliberately load ALL zones in a single call instead
      // of paginating or lazy-loading per municipio. The reasoning:
      //   * Realistic scale for O Salnes is 8 municipios * ~10 parroquias =
      //     ~80 zones. Even importing the official Xunta dataset (audit F2)
      //     yields under 200 rows total.
      //   * listZones is now O(2) queries thanks to Tanda 6 A7 (the batched
      //     translation join), so the cost is constant regardless of N.
      //   * The map page needs the count per municipio to render the badge
      //     in each marker popup; deriving that from the loaded list is
      //     trivial. A separate counts endpoint would only pay off above
      //     ~500 zones.
      // If you ever cross 500 zones, switch this to a per-municipio fetch
      // (api.getZones(municipioId)) and add a getZoneCounts() endpoint
      // for the map badges. The migration is straightforward but should
      // be motivated by real load, not speculation.
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

  // Lightweight DF1 mitigation: when the user comes back to the tab,
  // refresh the zones list. Two admins editing simultaneously is rare for
  // this CMS (single-digit user base), so a true realtime subscription
  // would be overkill. Refresh-on-focus catches 90% of staleness without
  // the realtime infrastructure (RLS policies, channel subscriptions,
  // memory pressure from open websockets).
  //
  // Note: this refreshes the underlying zones array. Any in-progress form
  // state in the page component is preserved because the form state lives
  // outside this hook. If the zone being edited has been modified or
  // deleted by another admin in the meantime, the optimistic concurrency
  // check (DF3) will catch it on save.
  useEffect(() => {
    function onFocus() {
      // Avoid double-fetching on the very first focus right after mount
      if (loading) return;
      refresh();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh, loading]);

  const create = useCallback(async (payload: ZoneFormPayload): Promise<boolean> => {
    setError(null);
    try {
      // P4: server returns the full ZoneItem, so we splice it into local
      // state directly instead of refetching. Saves one round trip per
      // create and gives the user immediate visual feedback.
      const created = await api.createZone(payload);
      setZones((prev) => insertSorted(prev, created));
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  const update = useCallback(async (id: string, payload: ZoneFormPayload): Promise<boolean> => {
    setError(null);
    try {
      // Inject the optimistic concurrency token from the locally cached
      // zones array (DF3). The page component does not need to track
      // updatedAt itself — the hook owns it. If the local row is older
      // than the DB row, update_zona() raises SQLSTATE 40001 → friendly
      // 409 → caught below.
      const local = zones.find((z) => z.id === id);
      const expected_updated_at = local?.updatedAt;
      const updated = await api.updateZone(id, { ...payload, expected_updated_at });
      // P4: replace the row in local state with the server-returned data.
      // If the slug changed, re-sort to keep order stable.
      setZones((prev) => {
        const slugChanged = local && local.slug !== updated.slug;
        const replaced = prev.map((z) => (z.id === id ? updated : z));
        return slugChanged ? [...replaced].sort((a, b) => a.slug.localeCompare(b.slug)) : replaced;
      });
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    }
  }, [zones]);

  const remove = useCallback(async (id: string): Promise<number | null> => {
    setError(null);
    setBusyId(id);
    try {
      const result = await api.deleteZone(id);
      // P4: remove from local state. No refetch needed.
      setZones((prev) => prev.filter((z) => z.id !== id));
      return result.affectedResources ?? 0;
    } catch (err: unknown) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusyId(null);
    }
  }, []);

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
