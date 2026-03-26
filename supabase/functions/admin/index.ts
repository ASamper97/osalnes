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

const FN = 'admin';
const BUCKET = 'media';

Deno.serve(async (req: Request) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const path = routePath(url, FN);
  const method = req.method;

  try {
    // Authenticate all requests
    const user = await verifyAuth(req);
    const sb = getAdminClient();

    // ==================================================================
    // Profile & Stats (required by CMS dashboard)
    // ==================================================================

    if (method === 'GET' && path === '/profile') {
      return json({ id: user.id, email: user.email, role: user.role, active: user.active }, 200, req);
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
      const body = await req.json();
      return await createResource(sb, body, req);
    }

    const resId = matchRoute('/resources/:id', path);

    if (method === 'PUT' && resId) {
      const body = await req.json();
      return await updateResource(sb, resId.id, body, req);
    }

    const resStatus = matchRoute('/resources/:id/status', path);
    if (method === 'PATCH' && resStatus) {
      requireRole(user, 'admin', 'editor', 'validador');
      const { status } = await req.json();
      return await updateResourceStatus(sb, resStatus.id, status, req);
    }

    if (method === 'DELETE' && resId) {
      return await deleteResource(sb, resId.id, req);
    }

    // ==================================================================
    // Multimedia (assets)
    // ==================================================================

    if (method === 'POST' && path === '/assets') {
      return await uploadAsset(sb, req);
    }

    if (method === 'GET' && path === '/assets') {
      const entidadTipo = url.searchParams.get('entidad_tipo') || 'recurso_turistico';
      const entidadId = url.searchParams.get('entidad_id');
      if (!entidadId) return json({ error: 'entidad_id is required' }, 400, req);
      return await listAssets(sb, entidadTipo, entidadId, req);
    }

    const assetId = matchRoute('/assets/:id', path);
    if (method === 'DELETE' && assetId) {
      return await deleteAsset(sb, assetId.id, req);
    }

    if (method === 'PATCH' && path === '/assets/reorder') {
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
      return await deleteUser(sb, userId.id, req);
    }

    // ==================================================================
    // Audit log
    // ==================================================================

    if (method === 'GET' && path === '/audit') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const entidadTipo = url.searchParams.get('entidad_tipo') || undefined;
      const offset = (page - 1) * limit;

      let q = sb.from('log_cambios').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (entidadTipo) q = q.eq('entidad_tipo', entidadTipo);
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
      const municipio = url.searchParams.get('municipio') || undefined;
      let q = sb.from('zona').select('id, slug, municipio_id').order('slug');
      if (municipio) q = q.eq('municipio_id', municipio);
      const { data, error: err } = await q;
      if (err) throw err;
      const items = await Promise.all((data || []).map(async (z) => ({
        id: z.id,
        slug: z.slug,
        municipioId: z.municipio_id,
        name: await getTranslatedField('zona', z.id, 'name'),
      })));
      return json(items, 200, req);
    }

    if (method === 'POST' && path === '/zones') {
      const body = await req.json();
      if (!body.slug || !body.municipio_id) return json({ error: 'slug and municipio_id required' }, 400, req);
      const { data, error: err } = await sb.from('zona').insert({
        slug: body.slug,
        municipio_id: body.municipio_id,
      }).select('id').single();
      if (err) throw err;
      if (body.name) {
        await saveTranslations('zona', data.id, 'name', body.name);
      }
      return json({ id: data.id }, 201, req);
    }

    const zoneId = matchRoute('/zones/:id', path);

    if (method === 'PUT' && zoneId) {
      const body = await req.json();
      const updates: Record<string, unknown> = {};
      if (body.slug) updates.slug = body.slug;
      if (body.municipio_id) updates.municipio_id = body.municipio_id;
      if (Object.keys(updates).length > 0) {
        const { error: err } = await sb.from('zona').update(updates).eq('id', zoneId.id);
        if (err) throw err;
      }
      if (body.name) {
        await saveTranslations('zona', zoneId.id, 'name', body.name);
      }
      return json({ ok: true }, 200, req);
    }

    if (method === 'DELETE' && zoneId) {
      const { error: err } = await sb.from('zona').delete().eq('id', zoneId.id);
      if (err) throw err;
      return json({ ok: true }, 200, req);
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
    const e = err as { status?: number; message?: string; code?: string };
    return json(
      { error: e.message || 'Internal server error' },
      e.status || 500,
      req,
    );
  }
});

// ========================================================================
// ─── Recursos ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function createResource(sb: any, input: any, req: Request) {
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
      serves_cuisine: input.serves_cuisine || [],
      is_accessible_for_free: input.is_accessible_for_free ?? null,
      public_access: input.public_access ?? null,
      occupancy: input.occupancy || null,
      opening_hours: input.opening_hours || null,
      extras: input.extras || {},
      visible_en_mapa: input.visible_en_mapa ?? true,
      estado_editorial: 'borrador',
    })
    .select()
    .single();

  if (error) throw { status: 400, message: error.message };

  if (input.name) await saveTranslations('recurso_turistico', data.id, 'name', input.name);
  if (input.description) await saveTranslations('recurso_turistico', data.id, 'description', input.description);
  if (input.seo_title) await saveTranslations('recurso_turistico', data.id, 'seo_title', input.seo_title);
  if (input.seo_description) await saveTranslations('recurso_turistico', data.id, 'seo_description', input.seo_description);

  if (input.category_ids?.length) {
    await sb.from('recurso_categoria').insert(
      input.category_ids.map((cid: string) => ({ recurso_id: data.id, categoria_id: cid })),
    );
  }

  return json(await mapResourceRow(sb, data), 201, req);
}

// deno-lint-ignore no-explicit-any
async function updateResource(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = { updated_at: new Date().toISOString() };

  const fields = [
    'rdf_type', 'rdf_types', 'municipio_id', 'zona_id', 'latitude', 'longitude',
    'address_street', 'address_postal', 'telephone', 'email', 'url',
    'same_as', 'tourist_types', 'rating_value', 'serves_cuisine',
    'is_accessible_for_free', 'public_access', 'occupancy',
    'opening_hours', 'extras', 'visible_en_mapa',
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

  if (error) throw { status: 400, message: error.message };
  if (!data) throw { status: 404, message: 'Resource not found' };

  if (input.name) await saveTranslations('recurso_turistico', id, 'name', input.name);
  if (input.description) await saveTranslations('recurso_turistico', id, 'description', input.description);
  if (input.seo_title) await saveTranslations('recurso_turistico', id, 'seo_title', input.seo_title);
  if (input.seo_description) await saveTranslations('recurso_turistico', id, 'seo_description', input.seo_description);

  if (input.category_ids !== undefined) {
    await sb.from('recurso_categoria').delete().eq('recurso_id', id);
    if (input.category_ids.length) {
      await sb.from('recurso_categoria').insert(
        input.category_ids.map((cid: string) => ({ recurso_id: id, categoria_id: cid })),
      );
    }
  }

  return json(await mapResourceRow(sb, data), 200, req);
}

const STATE_TRANSITIONS: Record<string, string[]> = {
  borrador: ['revision', 'archivado'],
  revision: ['publicado', 'borrador'],
  publicado: ['archivado', 'borrador'],
  archivado: ['borrador'],
};

// deno-lint-ignore no-explicit-any
async function updateResourceStatus(sb: any, id: string, newStatus: string, req: Request) {
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

  if (error) throw { status: 400, message: error.message };
  return json(await mapResourceRow(sb, data), 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteResource(sb: any, id: string, req: Request) {
  const { error } = await sb.from('recurso_turistico').delete().eq('id', id);
  if (error) throw { status: 400, message: error.message };
  return json({ deleted: true }, 200, req);
}

// ========================================================================
// ─── Multimedia (assets) ───
// ========================================================================

// deno-lint-ignore no-explicit-any
async function uploadAsset(sb: any, req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'No file uploaded' }, 400, req);

  const entidadTipo = (formData.get('entidad_tipo') as string) || 'recurso_turistico';
  const entidadId = formData.get('entidad_id') as string;
  const tipo = (formData.get('tipo') as string) || 'imagen';

  if (!entidadId) return json({ error: 'entidad_id is required' }, 400, req);

  const ext = file.name.split('.').pop() || 'bin';
  const storagePath = `${entidadTipo}/${entidadId}/${Date.now()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

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

  if (error) throw { status: 400, message: error.message };
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
  if (error) throw { status: 400, message: error.message };
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

  if (error) throw { status: 400, message: error.message };

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
    if (error) throw { status: 400, message: error.message };
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
  if (error) throw { status: 400, message: error.message };
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

  if (error) throw { status: 400, message: error.message };

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
    if (error) throw { status: 400, message: error.message };
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
  if (error) throw { status: 400, message: error.message };
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

  if (error) throw { status: 400, message: error.message };
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
    if (error) throw { status: 400, message: error.message };
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
  if (error) throw { status: 400, message: error.message };
  return await getPageById(sb, id, req);
}

// deno-lint-ignore no-explicit-any
async function deletePage(sb: any, id: string, req: Request) {
  await sb.from('traduccion').delete().eq('entidad_tipo', 'pagina').eq('entidad_id', id);
  const { error } = await sb.from('pagina').delete().eq('id', id);
  if (error) throw { status: 400, message: error.message };
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
    throw { status: 400, message: error.message };
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
  if (error) throw { status: 400, message: error.message };
  if (!data) throw { status: 404, message: 'Relation not found' };
  return json(data, 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteRelation(sb: any, id: string, req: Request) {
  const { error } = await sb.from('relacion_recurso').delete().eq('id', id);
  if (error) throw { status: 400, message: error.message };
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

  if (error) throw { status: 400, message: error.message };
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
  if (error) throw { status: 400, message: error.message };
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
  if (error) throw { status: 400, message: error.message };
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

  if (error) throw { status: 400, message: error.message };

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
      .select('id, uri, rdf_type, slug, latitude, longitude, address_street, address_postal, telephone, email, url, tourist_types, rating_value, serves_cuisine, opening_hours, extras, municipio_id, created_at, updated_at')
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
          if (row.rating_value) node.starRating = { '@type': 'Rating', ratingValue: row.rating_value };
          if (row.serves_cuisine?.length > 0) node.servesCuisine = row.serves_cuisine;
          if (row.opening_hours) node.openingHours = row.opening_hours;
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
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .order('nombre');

  if (error) throw error;
  return json(data || [], 200, req);
}

// deno-lint-ignore no-explicit-any
async function getUserById(sb: any, id: string, req: Request) {
  const { data, error } = await sb
    .from('usuario')
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) throw { status: 404, message: 'User not found' };
  return json(data, 200, req);
}

// deno-lint-ignore no-explicit-any
async function createUser(sb: any, input: any, req: Request) {
  if (!VALID_ROLES.includes(input.rol)) {
    throw { status: 400, message: `Rol invalido: ${input.rol}. Validos: ${VALID_ROLES.join(', ')}` };
  }

  const { data, error } = await sb
    .from('usuario')
    .insert({ email: input.email, nombre: input.nombre, rol: input.rol, activo: input.activo ?? true })
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') throw { status: 409, message: 'Ya existe un usuario con ese email' };
    throw { status: 400, message: error.message };
  }
  return json(data, 201, req);
}

// deno-lint-ignore no-explicit-any
async function updateUser(sb: any, id: string, input: any, req: Request) {
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {};
  if (input.email !== undefined) update.email = input.email;
  if (input.nombre !== undefined) update.nombre = input.nombre;
  if (input.rol !== undefined) {
    if (!VALID_ROLES.includes(input.rol)) throw { status: 400, message: `Rol invalido: ${input.rol}` };
    update.rol = input.rol;
  }
  if (input.activo !== undefined) update.activo = input.activo;

  const { data, error } = await sb
    .from('usuario')
    .update(update)
    .eq('id', id)
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .single();

  if (error) throw { status: 400, message: error.message };
  if (!data) throw { status: 404, message: 'User not found' };
  return json(data, 200, req);
}

// deno-lint-ignore no-explicit-any
async function deleteUser(sb: any, id: string, req: Request) {
  const { error } = await sb.from('usuario').update({ activo: false }).eq('id', id);
  if (error) throw { status: 400, message: error.message };
  return json({ deleted: true }, 200, req);
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

  if (error) throw { status: 400, message: error.message };

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
    if (error) throw { status: 400, message: error.message };
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
  if (error) throw { status: 400, message: error.message };
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
    servesCuisine: row.serves_cuisine || [],
    isAccessibleForFree: row.is_accessible_for_free,
    publicAccess: row.public_access, occupancy: row.occupancy,
    openingHours: row.opening_hours, extras: row.extras || {},
    status: row.estado_editorial, visibleOnMap: row.visible_en_mapa,
    publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at,
    // deno-lint-ignore no-explicit-any
    categoryIds: (cats || []).map((c: any) => c.categoria_id),
  };
}
