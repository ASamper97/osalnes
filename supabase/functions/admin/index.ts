/**
 * Admin API — Supabase Edge Function
 * Replaces packages/api/src/routes/admin.ts (Express).
 * All routes require a valid Supabase JWT.
 *
 * Invoked at: https://<ref>.supabase.co/functions/v1/admin/<path>
 */
import { handleCors, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase.ts';
import {
  getTranslations,
  getTranslatedField,
  saveTranslations,
} from '../_shared/translations.ts';
import { verifyAuth, requireRole, type AuthUser } from '../_shared/auth.ts';
import { routePath, matchRoute } from '../_shared/router.ts';
import { formatError } from '../_shared/errors.ts';
import { rateLimit } from '../_shared/rate-limit.ts';
import { listZones as listZonesShared, getZoneById } from '../_shared/zones.ts';

const FN = 'admin';
const BUCKET = 'media';

// Slug validation: lowercase letters, digits and hyphens only.
// Used by entities whose slug is part of public URLs (zonas, categorias…).
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Insert an audit row into log_cambios. Fire-and-forget so a logging
 * failure never blocks the main mutation. UNE 178502 §6.4 (trazabilidad)
 * requires that EVERY mutation records the actor (usuario_id), the
 * affected entity, the action and a structured diff.
 */
function logAudit(
  sb: ReturnType<typeof getAdminClient>,
  entidadTipo: string,
  entidadId: string,
  accion: string,
  usuarioId: string,
  cambios: Record<string, unknown>,
): void {
  sb.from('log_cambios').insert({
    entidad_tipo: entidadTipo,
    entidad_id: entidadId,
    accion,
    usuario_id: usuarioId,
    cambios,
  }).then(() => {}, (err) => {
    console.error('[audit] log_cambios insert failed:', err);
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const path = routePath(url, FN);
  const method = req.method;

  try {
    // Per-IP rate limit (120 req/min). Throws 429 on excess.
    // Runs BEFORE auth so a flooding client cannot exhaust DB connections.
    rateLimit(req);

    // Authenticate all requests
    const user = await verifyAuth(req);
    const sb = getAdminClient();

    // ==================================================================
    // Profile & Stats (required by CMS dashboard)
    // ==================================================================

    if (method === 'GET' && path === '/profile') {
      return json({
        id: user.id,
        email: user.email,
        role: user.role,
        active: user.active,
        municipioId: user.municipioId,
      }, 200, req);
    }

    if (method === 'GET' && path === '/stats') {
      // Resource counts by status
      const [published, draft, review, archived, total] = await Promise.all([
        sb.from('recurso_turistico').select('*', { count: 'exact', head: true }).eq('estado_editorial', 'publicado'),
        sb.from('recurso_turistico').select('*', { count: 'exact', head: true }).eq('estado_editorial', 'borrador'),
        sb.from('recurso_turistico').select('*', { count: 'exact', head: true }).eq('estado_editorial', 'revision'),
        sb.from('recurso_turistico').select('*', { count: 'exact', head: true }).eq('estado_editorial', 'archivado'),
        sb.from('recurso_turistico').select('*', { count: 'exact', head: true }),
      ]);

      const { count: muniCount } = await sb.from('municipio').select('*', { count: 'exact', head: true });
      const { count: catCount } = await sb.from('categoria').select('*', { count: 'exact', head: true });

      // Quality metrics — fetch more fields for UNE 178502 indicators
      const { data: allRes } = await sb
        .from('recurso_turistico')
        .select('id, latitude, longitude, updated_at')
        .eq('estado_editorial', 'publicado');

      const pubCount = published.count || 0;
      const withCoords = (allRes || []).filter((r) => r.latitude && r.longitude).length;

      // UNE 178502: descriptions completeness
      const pubIds = (allRes || []).map((r) => r.id);
      let withDesc = 0;
      let translationCounts: Record<string, number> = { es: 0, gl: 0, en: 0, fr: 0, pt: 0 };
      if (pubIds.length > 0) {
        const { data: descTrans } = await sb
          .from('traduccion')
          .select('entidad_id, campo, idioma')
          .eq('entidad_tipo', 'recurso_turistico')
          .in('campo', ['description', 'name'])
          .in('entidad_id', pubIds);
        const descSet = new Set<string>();
        const nameByLang: Record<string, Set<string>> = { es: new Set(), gl: new Set(), en: new Set(), fr: new Set(), pt: new Set() };
        for (const t of descTrans || []) {
          if (t.campo === 'description') descSet.add(t.entidad_id);
          if (t.campo === 'name' && nameByLang[t.idioma]) nameByLang[t.idioma].add(t.entidad_id);
        }
        withDesc = descSet.size;
        for (const lang of Object.keys(translationCounts)) {
          translationCounts[lang] = pubCount > 0 ? Math.round((nameByLang[lang].size / pubCount) * 100) : 0;
        }
      }

      // UNE 178502: images completeness
      let withImages = 0;
      if (pubIds.length > 0) {
        const { data: imgData } = await sb
          .from('asset_multimedia')
          .select('entidad_id')
          .eq('entidad_tipo', 'recurso_turistico')
          .in('entidad_id', pubIds);
        withImages = new Set((imgData || []).map((i) => i.entidad_id)).size;
      }

      // UNE 178502: freshness (updated in last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const updatedLast30 = (allRes || []).filter((r) => r.updated_at >= thirtyDaysAgo).length;
      const updatedLast90 = (allRes || []).filter((r) => r.updated_at >= ninetyDaysAgo).length;

      // UNE 178502: interoperability (exports)
      const { data: exportJobs } = await sb
        .from('export_job')
        .select('estado')
        .order('created_at', { ascending: false })
        .limit(20);
      const exportsOk = (exportJobs || []).filter((e) => e.estado === 'completado').length;
      const exportsTotal = (exportJobs || []).length;

      // Recent changes (trazabilidad UNE 178502 sec. 6.4)
      const { data: recentLogs } = await sb
        .from('log_cambios')
        .select('id, entidad_tipo, entidad_id, accion, usuario_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10);


      // Resources by municipality
      const { data: byMuni } = await sb
        .from('recurso_turistico')
        .select('municipio_id')
        .eq('estado_editorial', 'publicado');

      const muniDist: Record<string, number> = {};
      for (const r of byMuni || []) {
        muniDist[r.municipio_id] = (muniDist[r.municipio_id] || 0) + 1;
      }

      // Resources by type
      const { data: byType } = await sb
        .from('recurso_turistico')
        .select('rdf_type')
        .eq('estado_editorial', 'publicado');

      const typeDist: Record<string, number> = {};
      for (const r of byType || []) {
        typeDist[r.rdf_type] = (typeDist[r.rdf_type] || 0) + 1;
      }

      // Municipality names for chart
      const muniIds = Object.keys(muniDist);
      const resourcesByMunicipio: { name: string; count: number }[] = [];
      if (muniIds.length > 0) {
        const { data: muniNames } = await sb
          .from('traduccion')
          .select('entidad_id, valor')
          .eq('entidad_tipo', 'municipio')
          .eq('campo', 'name')
          .eq('idioma', 'es')
          .in('entidad_id', muniIds);
        const nameMap: Record<string, string> = {};
        for (const m of muniNames || []) nameMap[m.entidad_id] = m.valor;
        for (const [id, count] of Object.entries(muniDist)) {
          resourcesByMunicipio.push({ name: nameMap[id] || id, count });
        }
        resourcesByMunicipio.sort((a, b) => b.count - a.count);
      }

      // Group by tipo (grupo)
      const { data: tipoData } = await sb.from('tipologia').select('type_code, grupo');
      const grupoMap: Record<string, string> = {};
      for (const t of tipoData || []) grupoMap[t.type_code] = t.grupo;
      const grupoDist: Record<string, number> = {};
      for (const [type, count] of Object.entries(typeDist)) {
        const grupo = grupoMap[type] || 'otro';
        grupoDist[grupo] = (grupoDist[grupo] || 0) + count;
      }
      const resourcesByGroup = Object.entries(grupoDist).map(([grupo, count]) => ({ grupo, count }));

      // Last export
      const { data: lastExportData } = await sb
        .from('export_job')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      // Build alerts
      const alerts: { level: string; message: string }[] = [];
      const coordPct = pubCount > 0 ? Math.round((withCoords / pubCount) * 100) : 0;
      const descPct = pubCount > 0 ? Math.round((withDesc / pubCount) * 100) : 0;
      const imgPct = pubCount > 0 ? Math.round((withImages / pubCount) * 100) : 0;
      if (coordPct < 80) alerts.push({ level: 'warning', message: `Solo ${coordPct}% de recursos tienen coordenadas` });
      if (imgPct < 50) alerts.push({ level: 'warning', message: `Solo ${imgPct}% de recursos tienen imagenes` });
      if (descPct < 70) alerts.push({ level: 'info', message: `${descPct}% de recursos tienen descripcion` });

      return json({
        resources: {
          total: total.count || 0,
          published: pubCount,
          draft: draft.count || 0,
          review: review.count || 0,
          archived: archived.count || 0,
        },
        municipalities: muniCount || 0,
        categories: catCount || 0,
        quality: {
          withCoordinates: coordPct,
          withImages: imgPct,
          withDescription: descPct,
          translations: translationCounts,
        },
        une178502: {
          digitalizacion: pubCount > 0 ? Math.round(((withCoords + withDesc + withImages) / (pubCount * 3)) * 100) : 0,
          multilinguismo: pubCount > 0 ? Math.round(Object.values(translationCounts).reduce((a, b) => a + b, 0) / 5) : 0,
          geolocalizacion: coordPct,
          actualizacion30d: pubCount > 0 ? Math.round((updatedLast30 / pubCount) * 100) : 0,
          actualizacion90d: pubCount > 0 ? Math.round((updatedLast90 / pubCount) * 100) : 0,
          interoperabilidad: exportsTotal > 0 ? Math.round((exportsOk / exportsTotal) * 100) : 0,
        },
        alerts,
        resourcesByMunicipio,
        resourcesByGroup,
        recentChanges: (recentLogs || []).map((c) => ({
          id: c.id,
          entidad_tipo: c.entidad_tipo,
          accion: c.accion,
          created_at: c.created_at,
        })),
        lastExport: lastExportData?.[0] || null,
      }, 200, req);
    }

    // ==================================================================
    // CRUD Recursos
    // ==================================================================

    if (method === 'POST' && path === '/resources') {
      requireRole(user, 'admin', 'editor');
      const body = await req.json();
      return await createResource(sb, body, user.id, req);
    }

    const resId = matchRoute('/resources/:id', path);

    if (method === 'PUT' && resId) {
      requireRole(user, 'admin', 'editor');
      const body = await req.json();
      return await updateResource(sb, resId.id, body, user.id, req);
    }

    const resStatus = matchRoute('/resources/:id/status', path);
    if (method === 'PATCH' && resStatus) {
      requireRole(user, 'admin', 'editor', 'validador');
      const { status } = await req.json();
      return await updateResourceStatus(sb, resStatus.id, status, user.id, req);
    }

    if (method === 'DELETE' && resId) {
      requireRole(user, 'admin');  // borrar es operación destructiva: solo admin
      return await deleteResource(sb, resId.id, user.id, req);
    }

    // ==================================================================
    // Multimedia (assets)
    // ==================================================================

    if (method === 'POST' && path === '/assets') {
      requireRole(user, 'admin', 'editor', 'tecnico');
      return await uploadAsset(sb, user.id, req);
    }

    if (method === 'GET' && path === '/assets') {
      const entidadTipo = url.searchParams.get('entidad_tipo') || 'recurso_turistico';
      const entidadId = url.searchParams.get('entidad_id');
      if (!entidadId) return json({ error: 'entidad_id is required' }, 400, req);
      return await listAssets(sb, entidadTipo, entidadId, req);
    }

    const assetId = matchRoute('/assets/:id', path);
    if (method === 'DELETE' && assetId) {
      requireRole(user, 'admin', 'editor');
      return await deleteAsset(sb, assetId.id, req);
    }

    if (method === 'PATCH' && path === '/assets/reorder') {
      requireRole(user, 'admin', 'editor');
      const { items } = await req.json();
      if (!Array.isArray(items)) return json({ error: 'items array required' }, 400, req);
      await Promise.all(items.map((item: { id: string; orden: number }) =>
        sb.from('asset_multimedia').update({ orden: item.orden }).eq('id', item.id)
      ));
      return json({ ok: true }, 200, req);
    }

    // ==================================================================
    // Categorías
    // ==================================================================

    if (method === 'GET' && path === '/categories') {
      return await listCategories(sb, req);
    }

    if (method === 'POST' && path === '/categories') {
      const body = await req.json();
      return await createCategory(sb, body, req);
    }

    const catId = matchRoute('/categories/:id', path);

    if (method === 'PUT' && catId) {
      const body = await req.json();
      return await updateCategory(sb, catId.id, body, req);
    }

    if (method === 'DELETE' && catId) {
      return await deleteCategory(sb, catId.id, req);
    }

    // ==================================================================
    // Navegación
    // ==================================================================

    if (method === 'GET' && path === '/navigation') {
      const menu = url.searchParams.get('menu') || undefined;
      return await listNavigation(sb, menu, req);
    }

    if (method === 'POST' && path === '/navigation') {
      const body = await req.json();
      return await createNavItem(sb, body, req);
    }

    const reorderMenu = matchRoute('/navigation/reorder/:menuSlug', path);
    if (method === 'PATCH' && reorderMenu) {
      const { items } = await req.json();
      return await reorderNav(sb, reorderMenu.menuSlug, items, req);
    }

    const navId = matchRoute('/navigation/:id', path);

    if (method === 'PUT' && navId) {
      const body = await req.json();
      return await updateNavItem(sb, navId.id, body, req);
    }

    if (method === 'DELETE' && navId) {
      return await deleteNavItem(sb, navId.id, req);
    }

    // ==================================================================
    // Páginas editoriales
    // ==================================================================

    if (method === 'GET' && path === '/pages') {
      return await listPages(sb, req);
    }

    if (method === 'POST' && path === '/pages') {
      const body = await req.json();
      return await createPage(sb, body, req);
    }

    const pageStatus = matchRoute('/pages/:id/status', path);
    if (method === 'PATCH' && pageStatus) {
      const { status } = await req.json();
      return await updatePageStatus(sb, pageStatus.id, status, req);
    }

    const pageId = matchRoute('/pages/:id', path);

    if (method === 'GET' && pageId) {
      return await getPageById(sb, pageId.id, req);
    }

    if (method === 'PUT' && pageId) {
      const body = await req.json();
      return await updatePage(sb, pageId.id, body, req);
    }

    if (method === 'DELETE' && pageId) {
      return await deletePage(sb, pageId.id, req);
    }

    // ==================================================================
    // Relaciones entre recursos
    // ==================================================================

    if (method === 'GET' && path === '/relations') {
      const recursoId = url.searchParams.get('recurso_id');
      if (!recursoId) return json({ error: 'recurso_id is required' }, 400, req);
      return await listRelations(sb, recursoId, req);
    }

    if (method === 'POST' && path === '/relations') {
      const body = await req.json();
      return await createRelation(sb, body, req);
    }

    const relId = matchRoute('/relations/:id', path);

    if (method === 'PUT' && relId) {
      const body = await req.json();
      return await updateRelation(sb, relId.id, body, req);
    }

    if (method === 'DELETE' && relId) {
      return await deleteRelation(sb, relId.id, req);
    }

    // ==================================================================
    // Documentos descargables
    // ==================================================================

    if (method === 'POST' && path === '/documents') {
      return await uploadDocument(sb, req);
    }

    if (method === 'GET' && path === '/documents') {
      const entidadTipo = url.searchParams.get('entidad_tipo') || 'recurso_turistico';
      const entidadId = url.searchParams.get('entidad_id');
      if (!entidadId) return json({ error: 'entidad_id is required' }, 400, req);
      return await listDocuments(sb, entidadTipo, entidadId, req);
    }

    const docId = matchRoute('/documents/:id', path);

    if (method === 'PUT' && docId) {
      const body = await req.json();
      return await updateDocument(sb, docId.id, body, req);
    }

    if (method === 'DELETE' && docId) {
      return await deleteDocument(sb, docId.id, req);
    }

    // ==================================================================
    // Exportaciones (PID / Data Lake)
    // ==================================================================

    if (method === 'GET' && path === '/exports') {
      const tipo = url.searchParams.get('tipo') || undefined;
      return await listExportJobs(sb, tipo, req);
    }

    if (method === 'POST' && path === '/exports/pid') {
      requireRole(user, 'admin', 'tecnico');
      const body = await req.json();
      return await createExportJob(sb, 'pid', body, user.id, req);
    }

    if (method === 'POST' && path === '/exports/datalake') {
      requireRole(user, 'admin', 'tecnico');
      const body = await req.json();
      return await createExportJob(sb, 'datalake', body, user.id, req);
    }

    const exportId = matchRoute('/exports/:jobId', path);
    if (method === 'GET' && exportId) {
      return await getExportJob(sb, exportId.jobId, req);
    }

    // ==================================================================
    // Usuarios
    // ==================================================================

    if (method === 'GET' && path === '/users') {
      requireRole(user, 'admin');
      return await listUsers(sb, req);
    }

    if (method === 'POST' && path === '/users') {
      requireRole(user, 'admin');
      const body = await req.json();
      return await createUser(sb, body, req);
    }

    const userId = matchRoute('/users/:id', path);

    if (method === 'GET' && userId) {
      requireRole(user, 'admin');
      return await getUserById(sb, userId.id, req);
    }

    if (method === 'PUT' && userId) {
      requireRole(user, 'admin');
      const body = await req.json();
      return await updateUser(sb, userId.id, body, req);
    }

    if (method === 'DELETE' && userId) {
      requireRole(user, 'admin');
      return await deleteUserHard(sb, userId.id, req);
    }

    // POST /users/:id/deactivate
    const deactivateMatch = matchRoute('/users/:id/deactivate', path);
    if (method === 'POST' && deactivateMatch) {
      requireRole(user, 'admin');
      return await deactivateUser(sb, deactivateMatch.id, req);
    }

    // POST /users/:id/activate
    const activateMatch = matchRoute('/users/:id/activate', path);
    if (method === 'POST' && activateMatch) {
      requireRole(user, 'admin');
      return await activateUser(sb, activateMatch.id, req);
    }

    // POST /users/:id/resend-invite
    const resendMatch = matchRoute('/users/:id/resend-invite', path);
    if (method === 'POST' && resendMatch) {
      requireRole(user, 'admin');
      return await resendInvite(sb, resendMatch.id, req);
    }

    // ==================================================================
    // Audit log
    // ==================================================================

    if (method === 'GET' && path === '/audit') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const entidadTipo = url.searchParams.get('entidad_tipo') || undefined;
      const entidadId = url.searchParams.get('entidad_id') || undefined;
      const offset = (page - 1) * limit;

      let q = sb.from('log_cambios').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (entidadTipo) q = q.eq('entidad_tipo', entidadTipo);
      if (entidadId) q = q.eq('entidad_id', entidadId);
      const { data, error: err, count } = await q.range(offset, offset + limit - 1);
      if (err) throw err;

      return json({
        items: data || [],
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      }, 200, req);
    }

    // ==================================================================
    // Zonas geográficas
    // ==================================================================

    if (method === 'GET' && path === '/zones') {
      // Shared helper — single batched query (no N+1, audit P1).
      const municipio = url.searchParams.get('municipio') || undefined;
      const items = await listZonesShared(sb, municipio);
      return json(items, 200, req);
    }

    if (method === 'POST' && path === '/zones') {
      requireRole(user, 'admin', 'editor');
      const body = await req.json();
      if (!body.slug || !body.municipio_id) return json({ error: 'slug and municipio_id required' }, 400, req);
      // Validate slug format (kebab-case) — prevents URLs like "Centro Histórico!"
      if (!SLUG_RE.test(body.slug)) {
        return json({ error: 'El slug debe ser kebab-case (a-z, 0-9 y guiones)' }, 400, req);
      }
      // ES + GL are mandatory at the institutional level (Lei 5/1988 — gallego
      // cooficial). The frontend enforces this too, but we double-check here
      // because anyone can call the API directly with a valid token.
      if (!body.name?.es?.trim() || !body.name?.gl?.trim()) {
        return json({ error: 'Los nombres en castellano (es) y gallego (gl) son obligatorios.' }, 400, req);
      }
      // Single atomic call: zone + translations either both succeed or both
      // roll back. No more "zombie zone with no name" if step 2 fails (A6).
      const { data: newId, error: err } = await sb.rpc('create_zona', {
        p_slug: body.slug,
        p_municipio_id: body.municipio_id,
        p_name: body.name,
        p_created_by: user.id,
      });
      if (err) {
        // Friendly message for duplicate slug-per-municipio
        if ((err as { code?: string }).code === '23505') {
          return json(
            { error: `Ya existe una zona con el slug "${body.slug}" en este municipio. Elige otro.` },
            409,
            req,
          );
        }
        throw err;
      }
      logAudit(sb, 'zona', newId, 'crear', user.id, { slug: body.slug, municipio_id: body.municipio_id, name: body.name });
      // Return the full ZoneItem so the frontend can update its local state
      // without a follow-up listZones call (audit P4 — eliminates one round
      // trip from the create flow as perceived by the user).
      const created = await getZoneById(sb, newId);
      return json(created, 201, req);
    }

    const zoneId = matchRoute('/zones/:id', path);

    if (method === 'PUT' && zoneId) {
      requireRole(user, 'admin', 'editor');
      const body = await req.json();
      if (body.slug && !SLUG_RE.test(body.slug)) {
        return json({ error: 'El slug debe ser kebab-case (a-z, 0-9 y guiones)' }, 400, req);
      }
      // update_zona only touches columns whose argument is non-NULL, syncs
      // translations atomically, and (since migration 016) checks
      // p_expected_updated_at to detect concurrent edits. The frontend
      // sends `expected_updated_at` from the value it loaded; if another
      // admin has modified the row since, the RPC raises SQLSTATE 40001
      // which formatError() maps to a friendly 409.
      const { error: err } = await sb.rpc('update_zona', {
        p_id: zoneId.id,
        p_slug: body.slug || null,
        p_municipio_id: body.municipio_id || null,
        p_name: body.name || null,
        p_updated_by: user.id,
        p_expected_updated_at: body.expected_updated_at || null,
      });
      if (err) {
        if ((err as { code?: string }).code === '23505') {
          return json({ error: `Ya existe una zona con el slug "${body.slug}" en este municipio.` }, 409, req);
        }
        throw err;
      }
      logAudit(sb, 'zona', zoneId.id, 'modificar', user.id, { updates: body });
      // Return the full updated ZoneItem (same reasoning as POST — audit P4).
      const updated = await getZoneById(sb, zoneId.id);
      return json(updated, 200, req);
    }

    if (method === 'DELETE' && zoneId) {
      requireRole(user, 'admin', 'editor');
      // Disociar recursos antes de borrar — la UI promete que "los recursos
      // perderán la asociación", pero el FK no es ON DELETE SET NULL, así
      // que sin esto Postgres rechazaría el borrado con FK violation.
      const { count: affectedResources } = await sb
        .from('recurso_turistico')
        .update({ zona_id: null }, { count: 'exact' })
        .eq('zona_id', zoneId.id);
      // Borrar traducciones huérfanas
      await sb.from('traduccion')
        .delete()
        .eq('entidad_tipo', 'zona')
        .eq('entidad_id', zoneId.id);
      // Borrar la zona
      const { error: err } = await sb.from('zona').delete().eq('id', zoneId.id);
      if (err) throw err;
      logAudit(sb, 'zona', zoneId.id, 'eliminar', user.id, { affectedResources: affectedResources || 0 });
      return json({ ok: true, affectedResources: affectedResources || 0 }, 200, req);
    }

    // ==================================================================
    // Productos turísticos
    // ==================================================================

    if (method === 'GET' && path === '/products') {
      return await listProducts(sb, req);
    }

    if (method === 'POST' && path === '/products') {
      const body = await req.json();
      return await createProduct(sb, body, req);
    }

    const prodId = matchRoute('/products/:id', path);

    if (method === 'PUT' && prodId) {
      const body = await req.json();
      return await updateProduct(sb, prodId.id, body, req);
    }

    if (method === 'DELETE' && prodId) {
      return await deleteProduct(sb, prodId.id, req);
    }

    return json({ error: 'Not found' }, 404, req);
  } catch (err: unknown) {
    const [body, status] = formatError(err);
    return json(body, status, req);
  }
});

// ========================================================================
// ─── Recursos ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function createResource(sb: any, input: any, usuarioId: string, req: Request) {
  const uri = `osalnes:recurso:${input.slug}`;

  const { data, error } = await sb
    .from('recurso_turistico')
    .insert({
      uri,
      rdf_type: input.rdf_type,
      rdf_types: input.rdf_types || [],
      slug: input.slug,
      municipio_id: input.municipio_id || null,
      zona_id: input.zona_id || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      address_street: input.address_street || null,
      address_postal: input.address_postal || null,
      telephone: input.telephone || [],
      email: input.email || [],
      url: input.url || null,
      same_as: input.same_as || [],
      tourist_types: input.tourist_types || [],
      rating_value: input.rating_value || null,
      // Paso 4 · t5 — clasificación del establecimiento (migración 022).
      accommodation_rating: input.accommodation_rating ?? null,
      serves_cuisine: input.serves_cuisine || [],
      is_accessible_for_free: input.is_accessible_for_free ?? null,
      public_access: input.public_access ?? null,
      occupancy: input.occupancy || null,
      opening_hours: input.opening_hours || null,
      extras: input.extras || {},
      visible_en_mapa: input.visible_en_mapa ?? true,
      // Paso 3 · t4 — campos estructurados de la migración 021. Los legacy
      // (address_street, address_postal, telephone, email, url, same_as,
      // opening_hours) se siguen escribiendo arriba hasta la limpieza física.
      street_address: input.street_address ?? null,
      postal_code: input.postal_code ?? null,
      locality: input.locality ?? null,
      parroquia_text: input.parroquia_text ?? null,
      contact_phone: input.contact_phone ?? null,
      contact_email: input.contact_email ?? null,
      contact_web: input.contact_web ?? null,
      social_links: input.social_links ?? [],
      opening_hours_plan: input.opening_hours_plan ?? null,
      estado_editorial: 'borrador',
      created_by: usuarioId,
      updated_by: usuarioId,
    })
    .select()
    .single();

  if (error) throw error;  // formatError lo procesa con SQLSTATE → mensaje friendly

  // Sync translations in parallel (4 fields, ~4× faster than secuencial)
  await Promise.all([
    input.name ? saveTranslations('recurso_turistico', data.id, 'name', input.name) : Promise.resolve(),
    input.description ? saveTranslations('recurso_turistico', data.id, 'description', input.description) : Promise.resolve(),
    input.seo_title ? saveTranslations('recurso_turistico', data.id, 'seo_title', input.seo_title) : Promise.resolve(),
    input.seo_description ? saveTranslations('recurso_turistico', data.id, 'seo_description', input.seo_description) : Promise.resolve(),
  ]);

  if (input.category_ids?.length) {
    await sb.from('recurso_categoria').insert(
      input.category_ids.map((cid: string) => ({ recurso_id: data.id, categoria_id: cid })),
    );
  }

  // C2: audit log (UNE 178502 §6.4 trazabilidad de la entidad central)
  logAudit(sb, 'recurso_turistico', data.id, 'crear', usuarioId, {
    slug: input.slug,
    rdf_type: input.rdf_type,
    municipio_id: input.municipio_id || null,
    name: input.name || null,
  });

  return json(await mapResourceRow(sb, data), 201, req);
}

// deno-lint-ignore no-explicit-any
async function updateResource(sb: any, id: string, input: any, usuarioId: string, req: Request) {
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {
    updated_at: new Date().toISOString(),
    updated_by: usuarioId,
  };

  const fields = [
    'rdf_type', 'rdf_types', 'municipio_id', 'zona_id', 'latitude', 'longitude',
    'address_street', 'address_postal', 'telephone', 'email', 'url',
    'same_as', 'tourist_types', 'rating_value', 'serves_cuisine',
    // Paso 4 · t5 — campo nuevo migración 022.
    'accommodation_rating',
    'is_accessible_for_free', 'public_access', 'occupancy',
    'opening_hours', 'extras', 'visible_en_mapa',
    // Paso 3 · t4 — campos estructurados de la migración 021.
    'street_address', 'postal_code', 'locality', 'parroquia_text',
    'contact_phone', 'contact_email', 'contact_web',
    'social_links', 'opening_hours_plan',
  ];

  for (const f of fields) {
    if (input[f] !== undefined) update[f] = input[f];
  }

  if (input.slug !== undefined) {
    update.slug = input.slug;
    update.uri = `osalnes:recurso:${input.slug}`;
  }

  const { data, error } = await sb
    .from('recurso_turistico')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;  // formatError lo procesa
  if (!data) throw { status: 404, message: 'Recurso no encontrado' };

  // Translations en paralelo (mismo rationale que createResource)
  await Promise.all([
    input.name ? saveTranslations('recurso_turistico', id, 'name', input.name) : Promise.resolve(),
    input.description ? saveTranslations('recurso_turistico', id, 'description', input.description) : Promise.resolve(),
    input.seo_title ? saveTranslations('recurso_turistico', id, 'seo_title', input.seo_title) : Promise.resolve(),
    input.seo_description ? saveTranslations('recurso_turistico', id, 'seo_description', input.seo_description) : Promise.resolve(),
  ]);

  if (input.category_ids !== undefined) {
    await sb.from('recurso_categoria').delete().eq('recurso_id', id);
    if (input.category_ids.length) {
      await sb.from('recurso_categoria').insert(
        input.category_ids.map((cid: string) => ({ recurso_id: id, categoria_id: cid })),
      );
    }
  }

  // C2: audit log con la lista de campos modificados
  const changedFields = Object.keys(update).filter((k) => k !== 'updated_at' && k !== 'updated_by');
  if (input.name) changedFields.push('name');
  if (input.description) changedFields.push('description');
  if (input.seo_title) changedFields.push('seo_title');
  if (input.seo_description) changedFields.push('seo_description');
  if (input.category_ids !== undefined) changedFields.push('category_ids');
  logAudit(sb, 'recurso_turistico', id, 'modificar', usuarioId, {
    changed_fields: changedFields,
  });

  return json(await mapResourceRow(sb, data), 200, req);
}

const STATE_TRANSITIONS: Record<string, string[]> = {
  borrador: ['revision', 'archivado'],
  revision: ['publicado', 'borrador'],
  publicado: ['archivado', 'borrador'],
  archivado: ['borrador'],
};

// deno-lint-ignore no-explicit-any
async function updateResourceStatus(sb: any, id: string, newStatus: string, usuarioId: string, req: Request) {
  const validStates = ['borrador', 'revision', 'publicado', 'archivado'];
  if (!validStates.includes(newStatus)) {
    throw { status: 400, message: `Estado invalido: ${newStatus}` };
  }

  const { data: current, error: fetchError } = await sb
    .from('recurso_turistico')
    .select('estado_editorial')
    .eq('id', id)
    .single();

  if (fetchError || !current) throw { status: 404, message: 'Recurso no encontrado' };

  const allowed = STATE_TRANSITIONS[current.estado_editorial] || [];
  if (!allowed.includes(newStatus)) {
    throw {
      status: 400,
      message: `Transicion no permitida: ${current.estado_editorial} → ${newStatus}. Permitidas: ${allowed.join(', ')}`,
    };
  }

  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {
    estado_editorial: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === 'publicado') update.published_at = new Date().toISOString();

  const { data, error } = await sb
    .from('recurso_turistico')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Audit log (UNE 178502 trazabilidad)
  logAudit(
    sb,
    'recurso_turistico',
    id,
    newStatus === 'publicado' ? 'publicar' : newStatus === 'archivado' ? 'archivar' : 'modificar',
    usuarioId,
    { from: current.estado_editorial, to: newStatus },
  );

  // Optional webhook notification (audit S8 — signed with HMAC-SHA256
  // when WEBHOOK_SIGNING_SECRET is configured, so the receiver can verify
  // the request actually came from this Edge Function and was not spoofed).
  const webhookUrl = Deno.env.get('WEBHOOK_STATUS_CHANGE');
  if (webhookUrl && (newStatus === 'publicado' || newStatus === 'revision')) {
    const payload = JSON.stringify({
      event: 'resource.status_changed',
      resource_id: id,
      slug: data.slug,
      from_status: current.estado_editorial,
      to_status: newStatus,
      timestamp: new Date().toISOString(),
    });

    // Compute HMAC signature when a secret is configured.
    // The receiver verifies with the same secret + same payload string.
    // Header format follows GitHub-style: "X-Webhook-Signature: sha256=<hex>"
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const secret = Deno.env.get('WEBHOOK_SIGNING_SECRET');
    if (secret) {
      try {
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
        const sigHex = Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        headers['X-Webhook-Signature'] = `sha256=${sigHex}`;
        headers['X-Webhook-Timestamp'] = String(Date.now());
      } catch (err) {
        console.error('[webhook] HMAC computation failed:', err);
        // Fail open: send the webhook anyway, just without signature.
        // The receiver SHOULD reject unsigned requests if it expects signing.
      }
    }

    fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payload,
    }).catch(() => {}); // fire and forget
  }

  return json(await mapResourceRow(sb, data), 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteResource(sb: any, id: string, usuarioId: string, req: Request) {
  // C3 — cleanup completo antes de borrar la fila principal.
  //
  // El schema usa el patrón polimórfico (entidad_tipo + entidad_id) en
  // asset_multimedia, documento_descargable, traduccion y log_cambios.
  // Esas tablas NO tienen FK a recurso_turistico, así que el cascade
  // del DELETE no las toca → quedan filas huérfanas y, peor, archivos
  // huérfanos en Supabase Storage que cuestan dinero indefinidamente.
  //
  // Las tablas que SÍ tienen FK con ON DELETE CASCADE (recurso_categoria,
  // recurso_producto, relacion_recurso) se limpian automáticamente.

  // 1. Listar archivos físicos en Storage para borrarlos
  const { data: assets } = await sb
    .from('asset_multimedia')
    .select('id, storage_path')
    .eq('entidad_tipo', 'recurso_turistico')
    .eq('entidad_id', id);
  const { data: docs } = await sb
    .from('documento_descargable')
    .select('id, storage_path')
    .eq('entidad_tipo', 'recurso_turistico')
    .eq('entidad_id', id);

  const assetPaths = (assets || []).map((a: { storage_path: string | null }) => a.storage_path).filter(Boolean) as string[];
  const docPaths = (docs || []).map((d: { storage_path: string | null }) => d.storage_path).filter(Boolean) as string[];
  const allPaths = [...assetPaths, ...docPaths];

  // 2. Borrar archivos físicos del bucket (en una sola llamada batch)
  if (allPaths.length > 0) {
    const { error: storageErr } = await sb.storage.from(BUCKET).remove(allPaths);
    if (storageErr) {
      // No bloqueamos el delete si el bucket falla — registramos y seguimos
      console.error('[deleteResource] Storage cleanup failed:', storageErr);
    }
  }

  // 3. Borrar filas polimórficas huérfanas (no las cubre el FK cascade)
  await Promise.all([
    sb.from('asset_multimedia').delete().eq('entidad_tipo', 'recurso_turistico').eq('entidad_id', id),
    sb.from('documento_descargable').delete().eq('entidad_tipo', 'recurso_turistico').eq('entidad_id', id),
    sb.from('traduccion').delete().eq('entidad_tipo', 'recurso_turistico').eq('entidad_id', id),
  ]);

  // 4. Borrar el recurso. El FK cascade limpia recurso_categoria,
  //    recurso_producto y relacion_recurso automáticamente.
  const { error } = await sb.from('recurso_turistico').delete().eq('id', id);
  if (error) throw error;

  // 5. C2 + C3: audit log con el detalle del cleanup
  logAudit(sb, 'recurso_turistico', id, 'eliminar', usuarioId, {
    assets_deleted: assets?.length || 0,
    documents_deleted: docs?.length || 0,
    storage_files_removed: allPaths.length,
  });

  return json({
    deleted: true,
    cleanup: {
      assets: assets?.length || 0,
      documents: docs?.length || 0,
      storage_files: allPaths.length,
    },
  }, 200, req);
}

// ========================================================================
// ─── Multimedia (assets) ───
// ========================================================================

// C5 — Whitelist of allowed entidad_tipo values for asset uploads.
// Anything else is rejected so the storage path cannot be manipulated.
const ALLOWED_ASSET_ENTIDAD_TIPOS = new Set([
  'recurso_turistico',
  'pagina',
  'producto_turistico',
  'categoria',
]);

// C5 — Whitelist of MIME types per asset kind. Hard rejection of anything
// outside (e.g. image/svg+xml is BLOCKED because SVG can carry script).
const ALLOWED_MIMES_BY_TIPO: Record<string, string[]> = {
  imagen: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  video:  ['video/mp4', 'video/webm'],
  audio:  ['audio/mpeg', 'audio/ogg', 'audio/wav'],
};

// C5 — Per-kind size limits. Editorial team uploads phone photos (~5MB)
// and occasional drone footage (~50MB).
const MAX_BYTES_BY_TIPO: Record<string, number> = {
  imagen: 10 * 1024 * 1024,    //  10 MB
  video:  100 * 1024 * 1024,   // 100 MB
  audio:  20 * 1024 * 1024,    //  20 MB
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Magic bytes sniffing for image MIME validation. Accepts only files
 * whose first bytes match the declared MIME type. Defends against:
 *   - HTML or executables disguised as .jpg
 *   - SVG with embedded script (we don't accept SVG at all)
 *   - polyglot files
 */
function isValidImageMagic(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  if (mime === 'image/png')  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  if (mime === 'image/webp') return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
                                  && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  // AVIF: ftyp box at offset 4
  if (mime === 'image/avif') return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  return false;
}

// deno-lint-ignore no-explicit-any
async function uploadAsset(sb: any, usuarioId: string, req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'No file uploaded' }, 400, req);

  // C5 — sanitize entidad_tipo (must come from a fixed whitelist)
  const entidadTipo = (formData.get('entidad_tipo') as string) || 'recurso_turistico';
  if (!ALLOWED_ASSET_ENTIDAD_TIPOS.has(entidadTipo)) {
    return json({ error: `Tipo de entidad no permitido: ${entidadTipo}` }, 400, req);
  }

  // C5 — entidad_id MUST be a valid UUID (otherwise it's path injection)
  const entidadId = formData.get('entidad_id') as string;
  if (!entidadId) return json({ error: 'entidad_id es obligatorio' }, 400, req);
  if (!UUID_RE.test(entidadId)) {
    return json({ error: 'entidad_id debe ser un UUID válido' }, 400, req);
  }

  // C5 — tipo must be one of the whitelisted kinds
  const tipo = (formData.get('tipo') as string) || 'imagen';
  const allowedMimes = ALLOWED_MIMES_BY_TIPO[tipo];
  if (!allowedMimes) {
    return json({ error: `Tipo de asset desconocido: ${tipo}` }, 400, req);
  }

  // C5 — declared MIME must be in the whitelist
  if (!allowedMimes.includes(file.type)) {
    return json({
      error: `Tipo MIME no permitido: ${file.type}. Permitidos para "${tipo}": ${allowedMimes.join(', ')}`,
    }, 400, req);
  }

  // C5 — size limit per tipo
  const maxBytes = MAX_BYTES_BY_TIPO[tipo];
  if (file.size > maxBytes) {
    return json({
      error: `Archivo demasiado grande (${Math.round(file.size / 1024 / 1024)} MB). Máximo permitido para "${tipo}": ${Math.round(maxBytes / 1024 / 1024)} MB`,
    }, 413, req);
  }

  // C5 — magic bytes verification for images. Cheap (12-byte slice) and
  // catches the "disguised executable" attack.
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (tipo === 'imagen' && !isValidImageMagic(buffer.slice(0, 12), file.type)) {
    return json({
      error: 'El contenido del archivo no coincide con el tipo declarado. ¿Está corrupto o renombrado?',
    }, 400, req);
  }

  // C5 — sanitize filename: only [a-z0-9] in the extension, random UUID
  // for the basename so two uploads with the same name don't collide and
  // path traversal via filename is impossible.
  const declaredExt = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeExt = declaredExt.length > 0 && declaredExt.length <= 5 ? declaredExt : 'bin';
  const storagePath = `${entidadTipo}/${entidadId}/${crypto.randomUUID()}.${safeExt}`;

  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) throw { status: 400, message: `Upload failed: ${uploadError.message}` };

  const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);

  const { data: existing } = await sb
    .from('asset_multimedia')
    .select('orden')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('orden', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.orden ?? -1) + 1;

  const { data, error } = await sb
    .from('asset_multimedia')
    .insert({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      tipo,
      url: urlData.publicUrl,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      orden: nextOrder,
    })
    .select()
    .single();

  if (error) throw error;

  // Audit log: who uploaded what to which entity
  logAudit(sb, entidadTipo, entidadId, 'modificar', usuarioId, {
    asset_uploaded: { id: data.id, tipo, mime: file.type, size_bytes: file.size },
  });

  return json(data, 201, req);
}

// deno-lint-ignore no-explicit-any
async function listAssets(sb: any, entidadTipo: string, entidadId: string, req: Request) {
  const { data, error } = await sb
    .from('asset_multimedia')
    .select('*')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('orden');

  if (error) throw error;
  return json(data || [], 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteAsset(sb: any, assetId: string, req: Request) {
  const { data: asset, error: fetchError } = await sb
    .from('asset_multimedia')
    .select('storage_path')
    .eq('id', assetId)
    .single();

  if (fetchError || !asset) throw { status: 404, message: 'Asset not found' };

  if (asset.storage_path) {
    await sb.storage.from(BUCKET).remove([asset.storage_path]);
  }

  const { error } = await sb.from('asset_multimedia').delete().eq('id', assetId);
  if (error) throw error;
  return json({ deleted: true }, 200, req);
}

// ========================================================================
// ─── Categorías ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function listCategories(sb: any, req: Request) {
  const { data, error } = await sb
    .from('categoria')
    .select('id, slug, parent_id, orden, activo')
    .order('orden');

  if (error) throw error;

  const items = await Promise.all(
    (data || []).map(async (r: { id: string; slug: string; parent_id: string | null; orden: number; activo: boolean }) => ({
      id: r.id,
      slug: r.slug,
      parentId: r.parent_id,
      orden: r.orden,
      activo: r.activo,
      name: await getTranslatedField('categoria', r.id, 'name'),
    })),
  );
  return json(items, 200, req);
}

// deno-lint-ignore no-explicit-any
async function createCategory(sb: any, input: any, req: Request) {
  const { data, error } = await sb
    .from('categoria')
    .insert({
      slug: input.slug,
      parent_id: input.parent_id || null,
      orden: input.orden ?? 0,
      activo: input.activo ?? true,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.name) {
    for (const [lang, value] of Object.entries(input.name)) {
      if (!value) continue;
      await saveTranslations('categoria', data.id, 'name', { [lang]: value as string });
    }
  }

  return json({
    id: data.id, slug: data.slug, parentId: data.parent_id, orden: data.orden, activo: data.activo, name: input.name,
  }, 201, req);
}

// deno-lint-ignore no-explicit-any
async function updateCategory(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const updates: Record<string, any> = {};
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id || null;
  if (input.orden !== undefined) updates.orden = input.orden;
  if (input.activo !== undefined) updates.activo = input.activo;

  if (Object.keys(updates).length > 0) {
    const { error } = await sb.from('categoria').update(updates).eq('id', id);
    if (error) throw error;
  }

  if (input.name) {
    for (const [lang, value] of Object.entries(input.name)) {
      if (!value) continue;
      await saveTranslations('categoria', id, 'name', { [lang]: value as string });
    }
  }

  return json({ id, ...updates, name: input.name }, 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteCategory(sb: any, id: string, req: Request) {
  const { data: children } = await sb.from('categoria').select('id').eq('parent_id', id).limit(1);
  if (children?.length) {
    throw { status: 400, message: 'Cannot delete category with subcategories. Delete children first.' };
  }

  await sb.from('traduccion').delete().eq('entidad_tipo', 'categoria').eq('entidad_id', id);
  await sb.from('recurso_categoria').delete().eq('categoria_id', id);

  const { error } = await sb.from('categoria').delete().eq('id', id);
  if (error) throw error;
  return json({ deleted: true }, 200, req);
}

// ========================================================================
// ─── Navegación ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function listNavigation(sb: any, menuSlug: string | undefined, req: Request) {
  let query = sb
    .from('navegacion')
    .select('id, menu_slug, parent_id, tipo, referencia, orden, visible')
    .order('menu_slug')
    .order('orden');

  if (menuSlug) query = query.eq('menu_slug', menuSlug);

  const { data, error } = await query;
  if (error) throw error;

  const items = await Promise.all(
    // deno-lint-ignore no-explicit-any
    (data || []).map(async (r: any) => ({
      id: r.id,
      menuSlug: r.menu_slug,
      parentId: r.parent_id,
      tipo: r.tipo,
      referencia: r.referencia,
      orden: r.orden,
      visible: r.visible,
      label: await getTranslatedField('navegacion', r.id, 'label'),
    })),
  );
  return json(items, 200, req);
}

// deno-lint-ignore no-explicit-any
async function createNavItem(sb: any, input: any, req: Request) {
  const { data, error } = await sb
    .from('navegacion')
    .insert({
      menu_slug: input.menu_slug,
      parent_id: input.parent_id || null,
      tipo: input.tipo,
      referencia: input.referencia || null,
      orden: input.orden ?? 0,
      visible: input.visible ?? true,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.label) {
    for (const [lang, value] of Object.entries(input.label)) {
      if (!value) continue;
      await saveTranslations('navegacion', data.id, 'label', { [lang]: value as string });
    }
  }

  return json({
    id: data.id, menuSlug: data.menu_slug, parentId: data.parent_id,
    tipo: data.tipo, referencia: data.referencia, orden: data.orden,
    visible: data.visible, label: input.label,
  }, 201, req);
}

// deno-lint-ignore no-explicit-any
async function updateNavItem(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const updates: Record<string, any> = {};
  if (input.menu_slug !== undefined) updates.menu_slug = input.menu_slug;
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id || null;
  if (input.tipo !== undefined) updates.tipo = input.tipo;
  if (input.referencia !== undefined) updates.referencia = input.referencia || null;
  if (input.orden !== undefined) updates.orden = input.orden;
  if (input.visible !== undefined) updates.visible = input.visible;

  if (Object.keys(updates).length > 0) {
    const { error } = await sb.from('navegacion').update(updates).eq('id', id);
    if (error) throw error;
  }

  if (input.label) {
    for (const [lang, value] of Object.entries(input.label)) {
      if (!value) continue;
      await saveTranslations('navegacion', id, 'label', { [lang]: value as string });
    }
  }

  return json({ id, ...updates, label: input.label }, 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteNavItem(sb: any, id: string, req: Request) {
  const { data: children } = await sb.from('navegacion').select('id').eq('parent_id', id);
  if (children?.length) {
    throw { status: 400, message: 'Cannot delete navigation item with children. Delete children first.' };
  }

  await sb.from('traduccion').delete().eq('entidad_tipo', 'navegacion').eq('entidad_id', id);

  const { error } = await sb.from('navegacion').delete().eq('id', id);
  if (error) throw error;
  return json({ deleted: true }, 200, req);
}

// deno-lint-ignore no-explicit-any
async function reorderNav(sb: any, menuSlug: string, items: { id: string; orden: number }[], req: Request) {
  for (const item of items) {
    await sb.from('navegacion').update({ orden: item.orden }).eq('id', item.id).eq('menu_slug', menuSlug);
  }
  return json({ reordered: true }, 200, req);
}

// ========================================================================
// ─── Páginas editoriales ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function listPages(sb: any, req: Request) {
  const { data, error } = await sb
    .from('pagina')
    .select('id, slug, template, estado_editorial, published_at, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const items = await Promise.all(
    // deno-lint-ignore no-explicit-any
    (data || []).map(async (r: any) => ({
      id: r.id,
      slug: r.slug,
      template: r.template,
      status: r.estado_editorial,
      publishedAt: r.published_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      title: await getTranslatedField('pagina', r.id, 'title'),
    })),
  );
  return json(items, 200, req);
}

// deno-lint-ignore no-explicit-any
async function getPageById(sb: any, id: string, req: Request) {
  const { data, error } = await sb.from('pagina').select('*').eq('id', id).single();
  if (error || !data) throw { status: 404, message: 'Page not found' };

  const translations = await getTranslations('pagina', data.id);
  return json({
    id: data.id, slug: data.slug, template: data.template,
    status: data.estado_editorial, publishedAt: data.published_at,
    createdAt: data.created_at, updatedAt: data.updated_at,
    title: translations.title || {}, body: translations.body || {},
    seoTitle: translations.seo_title || {}, seoDescription: translations.seo_description || {},
  }, 200, req);
}

// deno-lint-ignore no-explicit-any
async function createPage(sb: any, input: any, req: Request) {
  const { data, error } = await sb
    .from('pagina')
    .insert({ slug: input.slug, template: input.template || 'default', estado_editorial: 'borrador' })
    .select()
    .single();

  if (error) throw error;
  await savePageTranslations(data.id, input);
  return await getPageById(sb, data.id, req);
}

// deno-lint-ignore no-explicit-any
async function updatePage(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {};
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.template !== undefined) update.template = input.template;

  if (Object.keys(update).length > 0) {
    const { error } = await sb.from('pagina').update(update).eq('id', id);
    if (error) throw error;
  }

  await savePageTranslations(id, input);
  return await getPageById(sb, id, req);
}

const PAGE_TRANSITIONS: Record<string, string[]> = {
  borrador: ['revision', 'archivado'],
  revision: ['publicado', 'borrador'],
  publicado: ['archivado', 'borrador'],
  archivado: ['borrador'],
};

// deno-lint-ignore no-explicit-any
async function updatePageStatus(sb: any, id: string, newStatus: string, req: Request) {
  const { data: current, error: fetchError } = await sb
    .from('pagina')
    .select('estado_editorial')
    .eq('id', id)
    .single();

  if (fetchError || !current) throw { status: 404, message: 'Page not found' };

  const allowed = PAGE_TRANSITIONS[current.estado_editorial] || [];
  if (!allowed.includes(newStatus)) {
    throw { status: 400, message: `Transicion no permitida: ${current.estado_editorial} → ${newStatus}` };
  }

  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = { estado_editorial: newStatus };
  if (newStatus === 'publicado') update.published_at = new Date().toISOString();

  const { error } = await sb.from('pagina').update(update).eq('id', id);
  if (error) throw error;
  return await getPageById(sb, id, req);
}

// deno-lint-ignore no-explicit-any
async function deletePage(sb: any, id: string, req: Request) {
  await sb.from('traduccion').delete().eq('entidad_tipo', 'pagina').eq('entidad_id', id);
  const { error } = await sb.from('pagina').delete().eq('id', id);
  if (error) throw error;
  return json({ deleted: true }, 200, req);
}

// deno-lint-ignore no-explicit-any
async function savePageTranslations(id: string, input: any) {
  const fields: [string, Record<string, string> | undefined][] = [
    ['title', input.title],
    ['body', input.body],
    ['seo_title', input.seo_title],
    ['seo_description', input.seo_description],
  ];
  for (const [campo, values] of fields) {
    if (!values) continue;
    await saveTranslations('pagina', id, campo, values);
  }
}

// ========================================================================
// ─── Relaciones ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function listRelations(sb: any, recursoId: string, req: Request) {
  const { data, error } = await sb
    .from('relacion_recurso')
    .select('id, recurso_origen, recurso_destino, tipo_relacion, orden, metadata, created_at')
    .or(`recurso_origen.eq.${recursoId},recurso_destino.eq.${recursoId}`)
    .order('orden');

  if (error) throw error;

  const items = await Promise.all(
    // deno-lint-ignore no-explicit-any
    (data || []).map(async (r: any) => {
      const relatedId = r.recurso_origen === recursoId ? r.recurso_destino : r.recurso_origen;
      return {
        id: r.id, recursoOrigen: r.recurso_origen, recursoDestino: r.recurso_destino,
        tipoRelacion: r.tipo_relacion, orden: r.orden, metadata: r.metadata,
        createdAt: r.created_at,
        relatedResourceName: await getTranslatedField('recurso_turistico', relatedId, 'name'),
      };
    }),
  );
  return json(items, 200, req);
}

// deno-lint-ignore no-explicit-any
async function createRelation(sb: any, input: any, req: Request) {
  if (input.recurso_origen === input.recurso_destino) {
    throw { status: 400, message: 'Un recurso no puede relacionarse consigo mismo' };
  }

  const { data, error } = await sb
    .from('relacion_recurso')
    .insert({
      recurso_origen: input.recurso_origen,
      recurso_destino: input.recurso_destino,
      tipo_relacion: input.tipo_relacion,
      orden: input.orden ?? 0,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw { status: 409, message: 'Esta relacion ya existe' };
    throw error;  // formatError mapea el SQLSTATE
  }
  return json(data, 201, req);
}

// deno-lint-ignore no-explicit-any
async function updateRelation(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {};
  if (input.tipo_relacion !== undefined) update.tipo_relacion = input.tipo_relacion;
  if (input.orden !== undefined) update.orden = input.orden;
  if (input.metadata !== undefined) update.metadata = input.metadata;

  const { data, error } = await sb.from('relacion_recurso').update(update).eq('id', id).select().single();
  if (error) throw error;
  if (!data) throw { status: 404, message: 'Relation not found' };
  return json(data, 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteRelation(sb: any, id: string, req: Request) {
  const { error } = await sb.from('relacion_recurso').delete().eq('id', id);
  if (error) throw error;
  return json({ deleted: true }, 200, req);
}

// ========================================================================
// ─── Documentos ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function uploadDocument(sb: any, req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'No file uploaded' }, 400, req);

  const entidadTipo = (formData.get('entidad_tipo') as string) || 'recurso_turistico';
  const entidadId = formData.get('entidad_id') as string;
  if (!entidadId) return json({ error: 'entidad_id is required' }, 400, req);

  const nombreRaw = formData.get('nombre') as string | null;
  const nombre = nombreRaw ? JSON.parse(nombreRaw) : {};

  const ext = file.name.split('.').pop() || 'bin';
  const storagePath = `documentos/${entidadTipo}/${entidadId}/${Date.now()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) throw { status: 400, message: `Upload failed: ${uploadError.message}` };

  const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);

  const { data: existing } = await sb
    .from('documento_descargable')
    .select('orden')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('orden', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.orden ?? -1) + 1;

  const { data, error } = await sb
    .from('documento_descargable')
    .insert({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      url: urlData.publicUrl,
      storage_path: storagePath,
      nombre,
      mime_type: file.type,
      size_bytes: file.size,
      orden: nextOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return json(data, 201, req);
}

// deno-lint-ignore no-explicit-any
async function listDocuments(sb: any, entidadTipo: string, entidadId: string, req: Request) {
  const { data, error } = await sb
    .from('documento_descargable')
    .select('*')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('orden');

  if (error) throw error;
  return json(data || [], 200, req);
}

// deno-lint-ignore no-explicit-any
async function updateDocument(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {};
  if (input.nombre !== undefined) update.nombre = input.nombre;
  if (input.orden !== undefined) update.orden = input.orden;

  const { data, error } = await sb.from('documento_descargable').update(update).eq('id', id).select().single();
  if (error) throw error;
  if (!data) throw { status: 404, message: 'Document not found' };
  return json(data, 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteDocument(sb: any, id: string, req: Request) {
  const { data: doc, error: fetchError } = await sb
    .from('documento_descargable')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError || !doc) throw { status: 404, message: 'Document not found' };

  if (doc.storage_path) {
    await sb.storage.from(BUCKET).remove([doc.storage_path]);
  }

  const { error } = await sb.from('documento_descargable').delete().eq('id', id);
  if (error) throw error;
  return json({ deleted: true }, 200, req);
}

// ========================================================================
// ─── Exportaciones ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function listExportJobs(sb: any, tipo: string | undefined, req: Request) {
  let query = sb
    .from('export_job')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query;
  if (error) throw error;
  return json(data || [], 200, req);
}

// deno-lint-ignore no-explicit-any
async function createExportJob(sb: any, tipo: string, parametros: any, userId: string, req: Request) {
  const { data, error } = await sb
    .from('export_job')
    .insert({
      tipo,
      estado: 'pendiente',
      parametros,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Process async — fire and forget (EdgeRuntime.waitUntil would be ideal, but
  // for now we just start the promise; it will continue in the same invocation)
  processExportJob(sb, data.id, tipo).catch(() => {});

  return json(data, 202, req);
}

// deno-lint-ignore no-explicit-any
async function getExportJob(sb: any, jobId: string, req: Request) {
  const { data, error } = await sb.from('export_job').select('*').eq('id', jobId).single();
  if (error || !data) throw { status: 404, message: 'Export job not found' };
  return json(data, 200, req);
}

// deno-lint-ignore no-explicit-any
async function processExportJob(sb: any, jobId: string, tipo: string) {
  await sb.from('export_job').update({ estado: 'en_proceso', started_at: new Date().toISOString() }).eq('id', jobId);

  try {
    // 1. Fetch published resources
    const { data: resources, error } = await sb
      .from('recurso_turistico')
      .select('id, uri, rdf_type, slug, latitude, longitude, address_street, address_postal, telephone, email, url, tourist_types, rating_value, accommodation_rating, serves_cuisine, occupancy, opening_hours, extras, municipio_id, created_at, updated_at')
      .eq('estado_editorial', 'publicado')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const rows = resources || [];

    // 2. Batch-fetch translations (fix N+1)
    const ids = rows.map((r: any) => r.id);
    const tMap: Record<string, Record<string, Record<string, string>>> = {};

    if (ids.length > 0) {
      const { data: translations } = await sb
        .from('traduccion')
        .select('entidad_id, campo, idioma, valor')
        .eq('entidad_tipo', 'recurso_turistico')
        .in('campo', ['name', 'description'])
        .in('entidad_id', ids);

      for (const t of translations || []) {
        if (!tMap[t.entidad_id]) tMap[t.entidad_id] = {};
        if (!tMap[t.entidad_id][t.campo]) tMap[t.entidad_id][t.campo] = {};
        tMap[t.entidad_id][t.campo][t.idioma] = t.valor;
      }
    }

    // 3. Fetch municipality names
    const muniIds = [...new Set(rows.map((r: any) => r.municipio_id).filter(Boolean))];
    const muniMap: Record<string, string> = {};
    if (muniIds.length > 0) {
      const { data: mt } = await sb.from('traduccion').select('entidad_id, valor')
        .eq('entidad_tipo', 'municipio').eq('campo', 'name').eq('idioma', 'es').in('entidad_id', muniIds);
      for (const m of mt || []) muniMap[m.entidad_id] = m.valor;
    }

    // 3b. Paso 4 · t6 — batch-fetch de tags UNE 178503 para el mapeo PID.
    //     La columna `field` es discriminante del destino PID:
    //       amenityFeature → schema.org amenityFeature[]
    //       accessibility  → schema.org amenityFeature[] (LocationFeatureSpec)
    //       cuisine        → schema.org servesCuisine[]
    //       touristType    → schema.org touristType[]
    //     `pid_exportable = true` excluye automáticamente los tags del grupo
    //     `curaduria-editorial` (field='editorial', pid_exportable=false).
    const pidTagsByResource: Record<string, Array<{ field: string; value: string }>> = {};
    if (ids.length > 0) {
      const { data: tagRows } = await sb
        .from('resource_tags')
        .select('resource_id, field, value')
        .eq('pid_exportable', true)
        .in('resource_id', ids);
      for (const t of tagRows || []) {
        (pidTagsByResource[t.resource_id] = pidTagsByResource[t.resource_id] || [])
          .push({ field: t.field, value: t.value });
      }
    }

    // 3c. Paso 5 · t6 — batch-fetch de imágenes y vídeos para el mapeo
    //     `hasMultimedia` (UNE 178503 §10.1.13). Documentos se exponen en la
    //     web pública como descargas y no se exportan al PID.
    const imagesByResource: Record<string, Array<{ storage_path: string; alt_text: string | null; is_primary: boolean; sort_order: number }>> = {};
    const videosByResource: Record<string, Array<{ url: string; title: string | null; thumbnail_url: string | null; sort_order: number }>> = {};
    if (ids.length > 0) {
      const [{ data: imgRows }, { data: vidRows }] = await Promise.all([
        sb.from('resource_images')
          .select('resource_id, storage_path, alt_text, is_primary, sort_order')
          .in('resource_id', ids)
          .order('sort_order', { ascending: true }),
        sb.from('resource_videos')
          .select('resource_id, url, title, thumbnail_url, sort_order')
          .in('resource_id', ids)
          .order('sort_order', { ascending: true }),
      ]);
      for (const img of imgRows || []) {
        (imagesByResource[img.resource_id] = imagesByResource[img.resource_id] || []).push({
          storage_path: img.storage_path,
          alt_text: img.alt_text ?? null,
          is_primary: !!img.is_primary,
          sort_order: img.sort_order ?? 0,
        });
      }
      for (const v of vidRows || []) {
        (videosByResource[v.resource_id] = videosByResource[v.resource_id] || []).push({
          url: v.url,
          title: v.title ?? null,
          thumbnail_url: v.thumbnail_url ?? null,
          sort_order: v.sort_order ?? 0,
        });
      }
    }

    // Helper: URL pública del bucket resource-images (público por migración 023).
    function imagePublicUrl(path: string): string {
      return sb.storage.from('resource-images').getPublicUrl(path).data.publicUrl as string;
    }

    // 4. Build export data
    let ok = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    const graph: any[] = [];

    for (const row of rows) {
      try {
        const names = tMap[row.id]?.name || {};
        const descs = tMap[row.id]?.description || {};

        if (tipo === 'pid' || tipo === 'jsonld') {
          const node: Record<string, any> = {
            '@context': 'https://schema.org',
            '@type': row.rdf_type || 'TouristAttraction',
            '@id': row.uri || `https://turismo.osalnes.gal/es/recurso/${row.slug}`,
            identifier: row.uri,
            url: `https://turismo.osalnes.gal/es/recurso/${row.slug}`,
          };

          // Multilingual names (PID format)
          if (Object.keys(names).length > 0) {
            node.name = Object.entries(names).map(([lang, val]) => ({ '@language': lang, '@value': val }));
          }
          if (Object.keys(descs).length > 0) {
            node.description = Object.entries(descs).map(([lang, val]) => ({ '@language': lang, '@value': val }));
          }

          if (row.latitude && row.longitude) {
            node.geo = { '@type': 'GeoCoordinates', latitude: Number(row.latitude), longitude: Number(row.longitude) };
          }
          node.address = {
            '@type': 'PostalAddress', addressCountry: 'ES', addressRegion: 'Pontevedra',
            addressLocality: muniMap[row.municipio_id] || '',
            ...(row.address_street && { streetAddress: row.address_street }),
            ...(row.address_postal && { postalCode: row.address_postal }),
          };
          if (row.telephone?.length > 0) node.telephone = row.telephone[0];
          if (row.email?.length > 0) node.email = row.email[0];
          if (row.url) node.sameAs = row.url;
          if (row.tourist_types?.length > 0) node.touristType = row.tourist_types;
          // Paso 4 · t6 — starRating desde accommodation_rating (migración
          // 022), con fallback al legacy rating_value hasta la limpieza
          // post-backfill. rating_value es, en rigor, review average en
          // schema.org, así que al migrar todos los datos a
          // accommodation_rating podremos quitar el fallback.
          const starRatingValue = row.accommodation_rating ?? row.rating_value;
          if (starRatingValue) {
            node.starRating = { '@type': 'Rating', ratingValue: starRatingValue };
          }
          if (row.occupancy != null) node.occupancy = row.occupancy;
          if (row.serves_cuisine?.length > 0) node.servesCuisine = row.serves_cuisine;
          if (row.opening_hours) node.openingHours = row.opening_hours;

          // Paso 4 · t6 — amenityFeature desde tags UNE 178503.
          //   field='amenityFeature' → { @type:'LocationFeatureSpecification', name }
          //   field='accessibility'  → idem pero con 'accessibility:' como prefijo
          //                            semántico (el consumidor PID lo distingue
          //                            por el prefijo del name).
          const pidTags = pidTagsByResource[row.id] || [];
          const amenities = pidTags
            .filter((t) => t.field === 'amenityFeature' || t.field === 'accessibility')
            .map((t) => ({
              '@type': 'LocationFeatureSpecification',
              name: t.field === 'accessibility' ? `accessibility:${t.value}` : t.value,
              value: true,
            }));
          if (amenities.length > 0) node.amenityFeature = amenities;

          // Paso 5 · t6 — hasMultimedia UNE 178503 §10.1.13.
          //   image    → ImageObject principal (is_primary=true) + galería.
          //   video    → VideoObject[] con contentUrl (URL externa).
          //   alt_text → caption/description de cada ImageObject (WCAG).
          const imgs = imagesByResource[row.id] || [];
          if (imgs.length > 0) {
            const sorted = [...imgs].sort((a, b) => {
              if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
              return a.sort_order - b.sort_order;
            });
            const imageObjects = sorted.map((img) => {
              const obj: Record<string, unknown> = {
                '@type': 'ImageObject',
                contentUrl: imagePublicUrl(img.storage_path),
                url: imagePublicUrl(img.storage_path),
              };
              if (img.alt_text) {
                obj.caption = img.alt_text;
                obj.description = img.alt_text;
              }
              return obj;
            });
            node.image = imageObjects.length === 1 ? imageObjects[0] : imageObjects;
          }

          const vids = videosByResource[row.id] || [];
          if (vids.length > 0) {
            node.video = vids
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((v) => {
                const obj: Record<string, unknown> = {
                  '@type': 'VideoObject',
                  contentUrl: v.url,
                  embedUrl: v.url,
                };
                if (v.title) obj.name = v.title;
                if (v.thumbnail_url) obj.thumbnailUrl = v.thumbnail_url;
                return obj;
              });
          }

          node['pid:dtiCode'] = 'osalnes';
          node['pid:lastUpdated'] = row.updated_at;

          graph.push(node);
        } else {
          // datalake / csv / json — flat format
          graph.push({
            id: row.id, uri: row.uri, type: row.rdf_type, slug: row.slug,
            name: names, description: descs,
            latitude: row.latitude, longitude: row.longitude,
            municipio: muniMap[row.municipio_id] || row.municipio_id,
            telephone: row.telephone, email: row.email, url: row.url,
            tourist_types: row.tourist_types, rating_value: row.rating_value,
            // Paso 4 · t6 — campos nuevos del establecimiento (migración 022).
            accommodation_rating: row.accommodation_rating,
            occupancy: row.occupancy,
            serves_cuisine: row.serves_cuisine,
            created_at: row.created_at, updated_at: row.updated_at,
          });
        }
        ok++;
      } catch (rowErr: any) {
        errors++;
        errorDetails.push(`${row.id}: ${rowErr.message || rowErr}`);
      }
    }

    // 5. Build final payload
    const isPid = tipo === 'pid' || tipo === 'jsonld';
    const payload = isPid
      ? { '@context': 'https://schema.org', '@graph': graph, 'pid:dtiCode': 'osalnes', 'pid:exportDate': new Date().toISOString(), 'pid:totalResources': ok }
      : { format: tipo, count: ok, data: graph };

    // 6. Save to Supabase Storage as downloadable file
    let storageUrl: string | null = null;
    try {
      const fileName = `exports/${tipo}_${jobId}.jsonld`;
      const fileContent = new TextEncoder().encode(JSON.stringify(payload, null, 2));
      const { error: uploadErr } = await sb.storage.from('media').upload(fileName, fileContent, { contentType: 'application/ld+json', upsert: true });
      if (!uploadErr) {
        const { data: urlData } = sb.storage.from('media').getPublicUrl(fileName);
        storageUrl = urlData?.publicUrl || null;
      }
    } catch { /* storage optional */ }

    // 7. PID push attempt (if configured)
    let pidResult: Record<string, any> = { skipped: true, reason: 'PID_API_KEY not configured' };
    if (tipo === 'pid') {
      const pidKey = Deno.env.get('PID_API_KEY');
      const pidEndpoint = Deno.env.get('PID_ENDPOINT') || 'https://pid.segittur.es/graphql';
      if (pidKey && pidKey !== 'pendiente_de_credenciales_segittur') {
        let pidOk = 0, pidErr = 0;
        for (const node of graph) {
          try {
            const res = await fetch(pidEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pidKey}`, 'X-DTI-Code': 'osalnes' },
              body: JSON.stringify({ query: 'mutation UpsertPlace($input: PlaceInput!) { upsertPlace(input: $input) { uri status } }', variables: { input: node } }),
            });
            if (res.ok) pidOk++; else pidErr++;
          } catch { pidErr++; }
        }
        pidResult = { endpoint: pidEndpoint, sent: graph.length, ok: pidOk, errors: pidErr };
      }
    }

    // 8. Mark completed
    await sb.from('export_job').update({
      estado: errors > 0 && ok === 0 ? 'error' : 'completado',
      completed_at: new Date().toISOString(),
      total_registros: rows.length, registros_ok: ok, registros_err: errors,
      resultado: { total: rows.length, ok, errors, errorDetails: errorDetails.slice(0, 20), storageUrl, pidPush: pidResult },
    }).eq('id', jobId);
  } catch (err) {
    await sb.from('export_job').update({
      estado: 'error', completed_at: new Date().toISOString(), resultado: { error: String(err) },
    }).eq('id', jobId);
  }
}

// ========================================================================
// ─── Usuarios ───
// ========================================================================

const VALID_ROLES = ['admin', 'editor', 'validador', 'tecnico', 'analitica'];

// deno-lint-ignore no-explicit-any
async function listUsers(sb: any, req: Request) {
  const { data, error } = await sb
    .from('usuario')
    .select('id, email, nombre, rol, activo, municipio_id, created_at, updated_at')
    .order('nombre');

  if (error) throw error;
  return json(data || [], 200, req);
}

// deno-lint-ignore no-explicit-any
async function getUserById(sb: any, id: string, req: Request) {
  const { data, error } = await sb
    .from('usuario')
    .select('id, email, nombre, rol, activo, municipio_id, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) throw { status: 404, message: 'User not found' };
  return json(data, 200, req);
}

/**
 * Create user via Supabase Auth invitation flow (NO EMAIL MODE).
 *
 * Uses generateLink() instead of inviteUserByEmail() so that:
 *   - The user is created in auth.users
 *   - A magic link is generated and returned to the admin
 *   - NO email is sent automatically (avoids SMTP dependency)
 *   - The admin copies the link and shares it via WhatsApp/email/etc.
 *
 * Steps:
 *   1. Validate role + check email not already used
 *   2. Call sb.auth.admin.generateLink({ type: 'invite' }) — creates user
 *      AND returns the action_link without sending an email
 *   3. Insert profile in `usuario` table with role and name
 *   4. If profile insert fails, rollback by deleting the auth user
 *   5. Return the user profile + action_link to the admin
 *
 * The admin NEVER sees a password. The invited user clicks the link,
 * goes to /auth/setup-password, and configures their own password.
 */
// deno-lint-ignore no-explicit-any
async function createUser(sb: any, input: any, req: Request) {
  if (!VALID_ROLES.includes(input.rol)) {
    throw { status: 400, message: `Rol invalido: ${input.rol}. Validos: ${VALID_ROLES.join(', ')}` };
  }
  if (!input.email || !input.nombre) {
    throw { status: 400, message: 'Email y nombre son obligatorios' };
  }

  // Check the email isn't already in the usuario table
  const { data: existing } = await sb
    .from('usuario')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();
  if (existing) {
    throw { status: 409, message: 'Ya existe un usuario con ese email' };
  }

  // 1. Generate invite link via Supabase Auth admin API (does NOT send email)
  const redirectTo = input.redirectTo || `${Deno.env.get('CMS_URL') || 'https://osalnes-cms.pages.dev'}/auth/setup-password`;

  const { data: linkData, error: authError } = await sb.auth.admin.generateLink({
    type: 'invite',
    email: input.email,
    options: {
      redirectTo,
      data: { nombre: input.nombre, rol: input.rol },
    },
  });

  if (authError) {
    console.error('[createUser] generateLink error:', authError);
    if (authError.message?.includes('already')) {
      throw { status: 409, message: 'Ya existe un usuario con ese email en el sistema de autenticacion' };
    }
    throw { status: 500, message: `Error al generar enlace: ${authError.message}` };
  }

  const actionLink = linkData?.properties?.action_link || null;
  const authUserId = linkData?.user?.id;

  // 2. Insert profile in usuario table
  const { data: profileData, error: profileError } = await sb
    .from('usuario')
    .insert({
      email: input.email,
      nombre: input.nombre,
      rol: input.rol,
      activo: true,
      // municipio_id es opcional — un admin o analítica no tiene "su municipio";
      // un editor local sí lo tendrá asignado para que el listado de Recursos
      // le venga prefiltrado (migración 019).
      municipio_id: input.municipio_id || null,
    })
    .select('id, email, nombre, rol, activo, municipio_id, created_at, updated_at')
    .single();

  if (profileError) {
    // Rollback: delete the auth user we just created
    console.error('[createUser] profile insert error, rolling back auth user:', profileError);
    if (authUserId) {
      try {
        await sb.auth.admin.deleteUser(authUserId);
      } catch (rollbackErr) {
        console.error('[createUser] rollback failed:', rollbackErr);
      }
    }
    if (profileError.code === '23505') {
      throw { status: 409, message: 'Ya existe un usuario con ese email' };
    }
    throw { status: 400, message: profileError.message };
  }

  return json({ ...profileData, invitation_link: actionLink }, 201, req);
}

// deno-lint-ignore no-explicit-any
async function updateUser(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {};
  if (input.nombre !== undefined) update.nombre = input.nombre;
  if (input.rol !== undefined) {
    if (!VALID_ROLES.includes(input.rol)) throw { status: 400, message: `Rol invalido: ${input.rol}` };
    update.rol = input.rol;
  }
  // municipio_id: puede venir null explícito para quitar la asignación, o
  // un uuid para cambiarlo. Solo se escribe si viene en el body.
  if (input.municipio_id !== undefined) {
    update.municipio_id = input.municipio_id || null;
  }
  // NOTE: email is intentionally not updatable (would desync auth.users)
  // NOTE: activo is managed via dedicated activate/deactivate endpoints

  const { data, error } = await sb
    .from('usuario')
    .update(update)
    .eq('id', id)
    .select('id, email, nombre, rol, activo, municipio_id, created_at, updated_at')
    .single();

  if (error) throw error;
  if (!data) throw { status: 404, message: 'User not found' };
  return json(data, 200, req);
}

/** Soft-disable: usuario keeps existing in BBDD but cannot log in */
// deno-lint-ignore no-explicit-any
async function deactivateUser(sb: any, id: string, req: Request) {
  // 1. Mark as inactive in usuario table
  const { data: profile, error } = await sb
    .from('usuario')
    .update({ activo: false })
    .eq('id', id)
    .select('email')
    .single();

  if (error) throw error;
  if (!profile) throw { status: 404, message: 'Usuario no encontrado' };

  // 2. Also ban the user in Supabase Auth (forbids new sessions)
  try {
    const { data: { users } } = await sb.auth.admin.listUsers();
    const authUser = users?.find((u: { email?: string }) => u.email === profile.email);
    if (authUser) {
      await sb.auth.admin.updateUserById(authUser.id, { ban_duration: '876000h' }); // ~100 years
    }
  } catch (err) {
    console.error('[deactivateUser] auth ban warning:', err);
    // Non-fatal: usuario.activo=false is enough to block access via getProfile()
  }

  return json({ deactivated: true }, 200, req);
}

/** Re-enable a previously deactivated user */
// deno-lint-ignore no-explicit-any
async function activateUser(sb: any, id: string, req: Request) {
  const { data: profile, error } = await sb
    .from('usuario')
    .update({ activo: true })
    .eq('id', id)
    .select('email')
    .single();

  if (error) throw error;
  if (!profile) throw { status: 404, message: 'Usuario no encontrado' };

  // Lift the ban from Supabase Auth
  try {
    const { data: { users } } = await sb.auth.admin.listUsers();
    const authUser = users?.find((u: { email?: string }) => u.email === profile.email);
    if (authUser) {
      await sb.auth.admin.updateUserById(authUser.id, { ban_duration: 'none' });
    }
  } catch (err) {
    console.error('[activateUser] auth unban warning:', err);
  }

  return json({ activated: true }, 200, req);
}

/** Hard delete: removes user from auth.users AND usuario table */
// deno-lint-ignore no-explicit-any
async function deleteUserHard(sb: any, id: string, req: Request) {
  // 1. Get email before deleting
  const { data: profile, error: fetchError } = await sb
    .from('usuario')
    .select('email')
    .eq('id', id)
    .single();

  if (fetchError) throw { status: 404, message: 'Usuario no encontrado' };

  // 2. Delete from auth.users (find by email)
  try {
    const { data: { users } } = await sb.auth.admin.listUsers();
    const authUser = users?.find((u: { email?: string }) => u.email === profile.email);
    if (authUser) {
      const { error: authError } = await sb.auth.admin.deleteUser(authUser.id);
      if (authError) {
        console.error('[deleteUserHard] auth delete error:', authError);
        // Continue anyway — we still want to remove the profile
      }
    }
  } catch (err) {
    console.error('[deleteUserHard] auth lookup error:', err);
  }

  // 3. Delete from usuario table (will fail if FK references exist)
  const { error: profileError } = await sb.from('usuario').delete().eq('id', id);
  if (profileError) {
    if (profileError.code === '23503') {
      throw {
        status: 409,
        message: 'No se puede eliminar: este usuario tiene contenido asociado (recursos creados/modificados). Desactivalo en su lugar.',
      };
    }
    throw { status: 400, message: profileError.message };
  }

  return json({ deleted: true }, 200, req);
}

/**
 * Generate a fresh invitation link for an existing user (NO EMAIL).
 * Uses generateLink({ type: 'magiclink' }) which works for users that
 * already exist in auth.users — perfect for "resend invitation" scenarios
 * where the user was created but never completed the setup-password flow.
 */
// deno-lint-ignore no-explicit-any
async function resendInvite(sb: any, id: string, req: Request) {
  const { data: profile, error } = await sb
    .from('usuario')
    .select('email, nombre, rol')
    .eq('id', id)
    .single();

  if (error || !profile) throw { status: 404, message: 'Usuario no encontrado' };

  const redirectTo = `${Deno.env.get('CMS_URL') || 'https://osalnes-cms.pages.dev'}/auth/setup-password`;

  // Try invite first (works if user has not completed setup yet)
  let actionLink: string | null = null;
  const { data: inviteData, error: inviteError } = await sb.auth.admin.generateLink({
    type: 'invite',
    email: profile.email,
    options: { redirectTo, data: { nombre: profile.nombre, rol: profile.rol } },
  });

  if (!inviteError && inviteData?.properties?.action_link) {
    actionLink = inviteData.properties.action_link;
  } else {
    // Fallback: user already accepted invite, generate a magiclink instead
    const { data: magicData, error: magicError } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
      options: { redirectTo },
    });

    if (magicError) {
      console.error('[resendInvite] both generateLink calls failed:', inviteError, magicError);
      throw { status: 500, message: `Error al generar enlace: ${magicError.message}` };
    }
    actionLink = magicData?.properties?.action_link || null;
  }

  if (!actionLink) {
    throw { status: 500, message: 'No se pudo generar el enlace de invitacion' };
  }

  return json({ invitation_link: actionLink, email: profile.email }, 200, req);
}

// ========================================================================
// ─── Productos turísticos ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function listProducts(sb: any, req: Request) {
  const { data, error } = await sb
    .from('producto_turistico')
    .select('id, slug, activo, created_at')
    .order('slug');

  if (error) throw error;

  const items = await Promise.all(
    // deno-lint-ignore no-explicit-any
    (data || []).map(async (r: any) => ({
      id: r.id, slug: r.slug, activo: r.activo, createdAt: r.created_at,
      name: await getTranslatedField('producto_turistico', r.id, 'name'),
      description: await getTranslatedField('producto_turistico', r.id, 'description'),
    })),
  );
  return json(items, 200, req);
}

// deno-lint-ignore no-explicit-any
async function createProduct(sb: any, input: any, req: Request) {
  const { data, error } = await sb
    .from('producto_turistico')
    .insert({ slug: input.slug, activo: input.activo ?? true })
    .select()
    .single();

  if (error) throw error;

  if (input.name) await saveTranslations('producto_turistico', data.id, 'name', input.name);
  if (input.description) await saveTranslations('producto_turistico', data.id, 'description', input.description);

  return json({ ...data, name: input.name || {}, description: input.description || {} }, 201, req);
}

// deno-lint-ignore no-explicit-any
async function updateProduct(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {};
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.activo !== undefined) update.activo = input.activo;

  if (Object.keys(update).length > 0) {
    const { error } = await sb.from('producto_turistico').update(update).eq('id', id);
    if (error) throw error;
  }

  if (input.name) await saveTranslations('producto_turistico', id, 'name', input.name);
  if (input.description) await saveTranslations('producto_turistico', id, 'description', input.description);

  return json({
    id,
    ...(input.slug !== undefined && { slug: input.slug }),
    name: input.name || await getTranslatedField('producto_turistico', id, 'name'),
    description: input.description || await getTranslatedField('producto_turistico', id, 'description'),
  }, 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteProduct(sb: any, id: string, req: Request) {
  await sb.from('recurso_producto').delete().eq('producto_id', id);
  await sb.from('traduccion').delete().eq('entidad_tipo', 'producto_turistico').eq('entidad_id', id);

  const { error } = await sb.from('producto_turistico').delete().eq('id', id);
  if (error) throw error;
  return json({ deleted: true }, 200, req);
}

// ========================================================================
// ─── Resource mapper (shared) ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function mapResourceRow(sb: any, row: Record<string, any>) {
  const translations = await getTranslations('recurso_turistico', row.id);

  const { data: cats } = await sb
    .from('recurso_categoria')
    .select('categoria_id')
    .eq('recurso_id', row.id);

  return {
    id: row.id, uri: row.uri, rdfType: row.rdf_type, rdfTypes: row.rdf_types || [], slug: row.slug,
    name: translations.name || {}, description: translations.description || {},
    seoTitle: translations.seo_title || {}, seoDescription: translations.seo_description || {},
    location: {
      latitude: row.latitude, longitude: row.longitude,
      streetAddress: row.address_street, postalCode: row.address_postal,
    },
    municipioId: row.municipio_id, zonaId: row.zona_id,
    contact: {
      telephone: row.telephone || [], email: row.email || [],
      url: row.url, sameAs: row.same_as || [],
    },
    touristTypes: row.tourist_types || [], ratingValue: row.rating_value,
    // Paso 4 · t5 — clasificación del establecimiento (migración 022).
    accommodationRating: row.accommodation_rating ?? null,
    servesCuisine: row.serves_cuisine || [],
    isAccessibleForFree: row.is_accessible_for_free,
    publicAccess: row.public_access, occupancy: row.occupancy,
    openingHours: row.opening_hours, extras: row.extras || {},
    status: row.estado_editorial, visibleOnMap: row.visible_en_mapa,
    publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at,
    // deno-lint-ignore no-explicit-any
    categoryIds: (cats || []).map((c: any) => c.categoria_id),
    // Paso 3 · t4 — campos estructurados de la migración 021. Se devuelven
    // en snake_case por coherencia con lo que envía el cliente en el body
    // de update; el hidratador del wizard los lee así directamente.
    street_address: row.street_address ?? null,
    postal_code: row.postal_code ?? null,
    locality: row.locality ?? null,
    parroquia_text: row.parroquia_text ?? null,
    contact_phone: row.contact_phone ?? null,
    contact_email: row.contact_email ?? null,
    contact_web: row.contact_web ?? null,
    social_links: row.social_links ?? [],
    opening_hours_plan: row.opening_hours_plan ?? null,
  };
}
