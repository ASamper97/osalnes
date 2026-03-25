import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import * as resourceService from '../services/resource.service.js';
import * as mediaService from '../services/media.service.js';
import * as categoryService from '../services/category.service.js';
import * as navigationService from '../services/navigation.service.js';
import * as pageService from '../services/page.service.js';
import * as relationService from '../services/relation.service.js';
import * as documentService from '../services/document.service.js';
import * as exportService from '../services/export.service.js';
import * as userService from '../services/user.service.js';
import * as productService from '../services/product.service.js';
import * as audit from '../services/audit.service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const adminRouter = Router();

// All admin routes require Supabase Auth JWT
adminRouter.use(authMiddleware);

/** Helper — Express @types may widen params to string | string[] */
function paramId(req: { params: Record<string, unknown> }, key = 'id'): string {
  return req.params[key] as string;
}

// ==========================================================================
// Profile (current user)
// ==========================================================================

/** GET /api/v1/admin/profile — returns current user's role and status */
adminRouter.get('/profile', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const role = (req as any).userRole as string;
  const dtiUserId = (req as any).dtiUserId as string;

  res.json({
    id: dtiUserId,
    email: user?.email,
    role,
    active: true, // if we got here, middleware already verified active
  });
}));

// ==========================================================================
// Dashboard Stats
// ==========================================================================

/** GET /api/v1/admin/stats — all authenticated roles */
// In-memory cache: avoids hitting DB on every Dashboard load
let _statsCache: { data: unknown; ts: number } | null = null;
const STATS_TTL_MS = 60_000; // 60 seconds

adminRouter.get('/stats', asyncHandler(async (_req, res) => {
  // Serve from cache if fresh
  if (_statsCache && Date.now() - _statsCache.ts < STATS_TTL_MS) {
    res.json(_statsCache.data);
    return;
  }

  const translationLangs = ['es', 'gl', 'en', 'fr', 'pt'];

  // ---------- All queries in parallel ----------
  const [
    { count: total },
    { count: published },
    { count: draft },
    { count: review },
    { count: archived },
    { count: municipalities },
    { count: categories },
    { count: withCoords },
    { count: withImages },
    { data: withDescIds },
    { data: byMunicipio },
    { data: muniRows },
    { data: byType },
    { data: recentChanges },
    { data: lastExport },
    ...translationResults
  ] = await Promise.all([
    // Resource counts by status
    supabase.from('recurso_turistico').select('*', { count: 'exact', head: true }),
    supabase.from('recurso_turistico').select('*', { count: 'exact', head: true }).eq('estado_editorial', 'publicado'),
    supabase.from('recurso_turistico').select('*', { count: 'exact', head: true }).eq('estado_editorial', 'borrador'),
    supabase.from('recurso_turistico').select('*', { count: 'exact', head: true }).eq('estado_editorial', 'revision'),
    supabase.from('recurso_turistico').select('*', { count: 'exact', head: true }).eq('estado_editorial', 'archivado'),
    // Counts
    supabase.from('municipio').select('*', { count: 'exact', head: true }),
    supabase.from('categoria').select('*', { count: 'exact', head: true }),
    // Quality (UNE 178502 sec. 6.5)
    supabase.from('recurso_turistico').select('*', { count: 'exact', head: true }).not('latitude', 'is', null).not('longitude', 'is', null),
    supabase.from('asset_multimedia').select('entidad_id', { count: 'exact', head: true }).eq('entidad_tipo', 'recurso_turistico'),
    supabase.from('traduccion').select('entidad_id').eq('entidad_tipo', 'recurso_turistico').eq('campo', 'description'),
    // Distribution (UNE 178502 sec. 6.3)
    supabase.from('recurso_turistico').select('municipio_id').not('municipio_id', 'is', null),
    supabase.from('municipio').select('id, slug'),
    supabase.from('recurso_turistico').select('rdf_type, tipologia:rdf_type ( grupo )'),
    // Activity
    supabase.from('log_cambios').select('id, entidad_tipo, entidad_id, accion, usuario_id, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('export_job').select('id, tipo, estado, registros_ok, registros_err, created_at, completed_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    // Translation completeness per language (5 parallel queries)
    ...translationLangs.map((lang) =>
      supabase.from('traduccion').select('entidad_id', { count: 'exact', head: true })
        .eq('entidad_tipo', 'recurso_turistico').eq('campo', 'name').eq('idioma', lang),
    ),
  ]);

  // ---------- Post-process ----------

  const totalNum = total || 0;

  // Translation counts
  const translationCounts: Record<string, number> = {};
  translationLangs.forEach((lang, i) => {
    translationCounts[lang] = (translationResults[i] as { count: number | null }).count || 0;
  });

  // Description completeness
  const uniqueDescIds = new Set((withDescIds || []).map((r: { entidad_id: string }) => r.entidad_id));

  // Resources per municipality
  const municipioCounts: Record<string, number> = {};
  for (const r of byMunicipio || []) {
    municipioCounts[(r as { municipio_id: string }).municipio_id] = (municipioCounts[(r as { municipio_id: string }).municipio_id] || 0) + 1;
  }
  const muniMap: Record<string, string> = {};
  for (const m of muniRows || []) { muniMap[(m as { id: string; slug: string }).id] = (m as { id: string; slug: string }).slug; }

  const resourcesByMunicipio = Object.entries(municipioCounts)
    .map(([id, count]) => ({ id, slug: muniMap[id] || id, count }))
    .sort((a, b) => b.count - a.count);

  // Resources per typology group
  const grupoCounts: Record<string, number> = {};
  for (const r of byType || []) {
    const grupo = (r as { tipologia: { grupo: string } | null }).tipologia?.grupo || 'otro';
    grupoCounts[grupo] = (grupoCounts[grupo] || 0) + 1;
  }

  const resourcesByGroup = Object.entries(grupoCounts)
    .map(([grupo, count]) => ({ grupo, count }))
    .sort((a, b) => b.count - a.count);

  // Content alerts — computed from data already loaded (no extra queries)
  const alerts: { level: 'warning' | 'error'; message: string }[] = [];
  const missingCoords = totalNum - (withCoords || 0);
  const missingDesc = totalNum - uniqueDescIds.size;
  const missingImages = totalNum - (withImages || 0);
  const missingGL = totalNum - (translationCounts['gl'] || 0);

  if (missingCoords > 0) alerts.push({ level: missingCoords > 5 ? 'error' : 'warning', message: `${missingCoords} recursos sin coordenadas` });
  if (missingDesc > 0) alerts.push({ level: missingDesc > 10 ? 'error' : 'warning', message: `${missingDesc} recursos sin descripcion` });
  if (missingImages > 0) alerts.push({ level: 'warning', message: `${missingImages} recursos sin imagenes` });
  if (missingGL > 0) alerts.push({ level: missingGL > 10 ? 'error' : 'warning', message: `${missingGL} recursos sin traduccion al gallego` });

  const payload = {
    resources: {
      total: totalNum,
      published: published || 0,
      draft: draft || 0,
      review: review || 0,
      archived: archived || 0,
    },
    municipalities: municipalities || 0,
    categories: categories || 0,
    quality: {
      withCoordinates: totalNum > 0 ? Math.round(((withCoords || 0) / totalNum) * 100) : 0,
      withImages: totalNum > 0 ? Math.round(((withImages || 0) / totalNum) * 100) : 0,
      withDescription: totalNum > 0 ? Math.round((uniqueDescIds.size / totalNum) * 100) : 0,
      translations: Object.fromEntries(
        translationLangs.map((lang) => [lang, totalNum > 0 ? Math.round((translationCounts[lang] / totalNum) * 100) : 0]),
      ),
    },
    alerts,
    resourcesByMunicipio,
    resourcesByGroup,
    recentChanges: recentChanges || [],
    lastExport: lastExport || null,
  };

  _statsCache = { data: payload, ts: Date.now() };
  res.json(payload);
}));

// ==========================================================================
// CRUD Recursos
// ==========================================================================

/** POST /api/v1/admin/resources — admin, editor */
adminRouter.post(
  '/resources',
  requireRole('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const resource = await resourceService.createResource(req.body);
    audit.log('recurso_turistico', resource.id, 'crear', (req as any).dtiUserId, { slug: resource.slug, rdfType: resource.rdfType });
    res.status(201).json(resource);
  }),
);

/** PUT /api/v1/admin/resources/:id — admin, editor */
adminRouter.put(
  '/resources/:id',
  requireRole('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const resource = await resourceService.updateResource(paramId(req), req.body);
    audit.log('recurso_turistico', paramId(req), 'modificar', (req as any).dtiUserId, { fields: Object.keys(req.body) });
    res.json(resource);
  }),
);

/** PATCH /api/v1/admin/resources/:id/status — admin, editor, validador */
adminRouter.patch(
  '/resources/:id/status',
  requireRole('admin', 'editor', 'validador'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const resource = await resourceService.updateResourceStatus(paramId(req), status);
    const accion = status === 'publicado' ? 'publicar' as const : status === 'archivado' ? 'archivar' as const : 'modificar' as const;
    audit.log('recurso_turistico', paramId(req), accion, (req as any).dtiUserId, { newStatus: status });
    res.json(resource);
  }),
);

/** DELETE /api/v1/admin/resources/:id — admin only */
adminRouter.delete(
  '/resources/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await resourceService.deleteResource(paramId(req));
    audit.log('recurso_turistico', paramId(req), 'eliminar', (req as any).dtiUserId);
    res.json(result);
  }),
);

// ==========================================================================
// Multimedia
// ==========================================================================

/** POST /api/v1/admin/assets — upload file (multipart/form-data) — admin, editor */
adminRouter.post('/assets', requireRole('admin', 'editor'), upload.single('file'), asyncHandler(async (req, res) => {
  const file = (req as any).file;
  if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'audio/mpeg'];
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    res.status(400).json({ error: `File type not allowed: ${file.mimetype}` });
    return;
  }

  const entidadTipo = req.body.entidad_tipo || 'recurso_turistico';
  const entidadId = req.body.entidad_id;
  const tipo = req.body.tipo || 'imagen';

  if (!entidadId) { res.status(400).json({ error: 'entidad_id is required' }); return; }

  const asset = await mediaService.uploadAsset(entidadTipo, entidadId, file, tipo);
  res.status(201).json(asset);
}));

/** GET /api/v1/admin/assets?entidad_tipo=X&entidad_id=Y */
adminRouter.get('/assets', asyncHandler(async (req, res) => {
  const entidadTipo = req.query.entidad_tipo as string || 'recurso_turistico';
  const entidadId = req.query.entidad_id as string;
  if (!entidadId) { res.status(400).json({ error: 'entidad_id is required' }); return; }

  const assets = await mediaService.listAssets(entidadTipo, entidadId);
  res.json(assets);
}));

/** DELETE /api/v1/admin/assets/:id — admin only */
adminRouter.delete('/assets/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await mediaService.deleteAsset(paramId(req));
  res.json(result);
}));

// ==========================================================================
// Categorias
// ==========================================================================

/** GET /api/v1/admin/categories */
adminRouter.get('/categories', asyncHandler(async (_req, res) => {
  const categories = await categoryService.listCategories();
  res.json(categories);
}));

/** POST /api/v1/admin/categories — admin only */
adminRouter.post('/categories', requireRole('admin'), asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  audit.log('categoria', category.id, 'crear', (req as any).dtiUserId, { slug: category.slug });
  res.status(201).json(category);
}));

/** PUT /api/v1/admin/categories/:id — admin only */
adminRouter.put('/categories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(paramId(req), req.body);
  audit.log('categoria', paramId(req), 'modificar', (req as any).dtiUserId);
  res.json(category);
}));

/** DELETE /api/v1/admin/categories/:id — admin only */
adminRouter.delete('/categories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(paramId(req));
  audit.log('categoria', paramId(req), 'eliminar', (req as any).dtiUserId);
  res.json(result);
}));

// ==========================================================================
// Navegacion
// ==========================================================================

/** GET /api/v1/admin/navigation */
adminRouter.get('/navigation', asyncHandler(async (req, res) => {
  const menuSlug = req.query.menu as string | undefined;
  const items = await navigationService.listNavigation(menuSlug);
  res.json(items);
}));

/** POST /api/v1/admin/navigation — admin only */
adminRouter.post('/navigation', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await navigationService.createNavItem(req.body);
  res.status(201).json(item);
}));

/** PUT /api/v1/admin/navigation/:id — admin only */
adminRouter.put('/navigation/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await navigationService.updateNavItem(paramId(req), req.body);
  res.json(item);
}));

/** DELETE /api/v1/admin/navigation/:id — admin only */
adminRouter.delete('/navigation/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await navigationService.deleteNavItem(paramId(req));
  res.json(result);
}));

/** PATCH /api/v1/admin/navigation/reorder/:menuSlug — admin only */
adminRouter.patch('/navigation/reorder/:menuSlug', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await navigationService.reorderMenu(paramId(req, 'menuSlug'), req.body.items);
  res.json(result);
}));

// ==========================================================================
// Paginas editoriales
// ==========================================================================

/** GET /api/v1/admin/pages */
adminRouter.get('/pages', asyncHandler(async (_req, res) => {
  const pages = await pageService.listPages();
  res.json(pages);
}));

/** GET /api/v1/admin/pages/:id */
adminRouter.get('/pages/:id', asyncHandler(async (req, res) => {
  const page = await pageService.getPageById(paramId(req));
  res.json(page);
}));

/** POST /api/v1/admin/pages — admin, editor */
adminRouter.post('/pages', requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
  const page = await pageService.createPage(req.body);
  audit.log('pagina', page.id, 'crear', (req as any).dtiUserId, { slug: page.slug });
  res.status(201).json(page);
}));

/** PUT /api/v1/admin/pages/:id — admin, editor */
adminRouter.put('/pages/:id', requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
  const page = await pageService.updatePage(paramId(req), req.body);
  audit.log('pagina', paramId(req), 'modificar', (req as any).dtiUserId);
  res.json(page);
}));

/** PATCH /api/v1/admin/pages/:id/status — admin, editor, validador */
adminRouter.patch('/pages/:id/status', requireRole('admin', 'editor', 'validador'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const page = await pageService.updatePageStatus(paramId(req), status);
  const accion = status === 'publicado' ? 'publicar' as const : status === 'archivado' ? 'archivar' as const : 'modificar' as const;
  audit.log('pagina', paramId(req), accion, (req as any).dtiUserId, { newStatus: status });
  res.json(page);
}));

/** DELETE /api/v1/admin/pages/:id — admin only */
adminRouter.delete('/pages/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await pageService.deletePage(paramId(req));
  audit.log('pagina', paramId(req), 'eliminar', (req as any).dtiUserId);
  res.json(result);
}));

// ==========================================================================
// Relaciones entre recursos
// ==========================================================================

/** GET /api/v1/admin/relations?recurso_id=X */
adminRouter.get('/relations', asyncHandler(async (req, res) => {
  const recursoId = req.query.recurso_id as string;
  if (!recursoId) { res.status(400).json({ error: 'recurso_id is required' }); return; }
  const relations = await relationService.listRelations(recursoId);
  res.json(relations);
}));

/** POST /api/v1/admin/relations — admin, editor */
adminRouter.post('/relations', requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
  const relation = await relationService.createRelation(req.body);
  res.status(201).json(relation);
}));

/** PUT /api/v1/admin/relations/:id — admin, editor */
adminRouter.put('/relations/:id', requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
  const relation = await relationService.updateRelation(paramId(req), req.body);
  res.json(relation);
}));

/** DELETE /api/v1/admin/relations/:id — admin only */
adminRouter.delete('/relations/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await relationService.deleteRelation(paramId(req));
  res.json(result);
}));

// ==========================================================================
// Documentos descargables
// ==========================================================================

/** POST /api/v1/admin/documents — upload document (multipart/form-data) — admin, editor */
adminRouter.post('/documents', requireRole('admin', 'editor'), upload.single('file'), asyncHandler(async (req, res) => {
  const file = (req as any).file;
  if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const ALLOWED_MIME = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain'];
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    res.status(400).json({ error: `File type not allowed: ${file.mimetype}` });
    return;
  }

  const entidadTipo = req.body.entidad_tipo || 'recurso_turistico';
  const entidadId = req.body.entidad_id;
  if (!entidadId) { res.status(400).json({ error: 'entidad_id is required' }); return; }

  let nombre: Record<string, string> | undefined;
  if (req.body.nombre) {
    try { nombre = JSON.parse(req.body.nombre); } catch { res.status(400).json({ error: 'Invalid JSON in nombre field' }); return; }
  }
  const doc = await documentService.uploadDocument(entidadTipo, entidadId, file, nombre);
  res.status(201).json(doc);
}));

/** GET /api/v1/admin/documents?entidad_tipo=X&entidad_id=Y */
adminRouter.get('/documents', asyncHandler(async (req, res) => {
  const entidadTipo = req.query.entidad_tipo as string || 'recurso_turistico';
  const entidadId = req.query.entidad_id as string;
  if (!entidadId) { res.status(400).json({ error: 'entidad_id is required' }); return; }

  const docs = await documentService.listDocuments(entidadTipo, entidadId);
  res.json(docs);
}));

/** PUT /api/v1/admin/documents/:id — admin, editor */
adminRouter.put('/documents/:id', requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
  const doc = await documentService.updateDocument(paramId(req), req.body);
  res.json(doc);
}));

/** DELETE /api/v1/admin/documents/:id — admin only */
adminRouter.delete('/documents/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await documentService.deleteDocument(paramId(req));
  res.json(result);
}));

// ==========================================================================
// Exportaciones (PID / Data Lake)
// ==========================================================================

/** GET /api/v1/admin/exports */
adminRouter.get('/exports', asyncHandler(async (req, res) => {
  const tipo = req.query.tipo as string | undefined;
  const jobs = await exportService.listExportJobs(tipo);
  res.json(jobs);
}));

/** POST /api/v1/admin/exports/pid — admin, tecnico */
adminRouter.post('/exports/pid', requireRole('admin', 'tecnico'), asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  const job = await exportService.createExportJob('pid', req.body, userId);
  res.status(202).json(job);
}));

/** POST /api/v1/admin/exports/datalake — admin, tecnico */
adminRouter.post('/exports/datalake', requireRole('admin', 'tecnico'), asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  const job = await exportService.createExportJob('datalake', req.body, userId);
  res.status(202).json(job);
}));

/** GET /api/v1/admin/exports/:jobId */
adminRouter.get('/exports/:jobId', asyncHandler(async (req, res) => {
  const job = await exportService.getExportJob(paramId(req, 'jobId'));
  res.json(job);
}));

// ==========================================================================
// Usuarios
// ==========================================================================

/** GET /api/v1/admin/users — admin only */
adminRouter.get('/users', requireRole('admin'), asyncHandler(async (_req, res) => {
  const users = await userService.listUsers();
  res.json(users);
}));

/** GET /api/v1/admin/users/:id — admin only */
adminRouter.get('/users/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const user = await userService.getUserById(paramId(req));
  res.json(user);
}));

/** POST /api/v1/admin/users — admin only */
adminRouter.post('/users', requireRole('admin'), asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
}));

/** PUT /api/v1/admin/users/:id — admin only */
adminRouter.put('/users/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const user = await userService.updateUser(paramId(req), req.body);
  res.json(user);
}));

/** DELETE /api/v1/admin/users/:id — admin only */
adminRouter.delete('/users/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await userService.deleteUser(paramId(req));
  res.json(result);
}));

// ==========================================================================
// Productos turisticos
// ==========================================================================

/** GET /api/v1/admin/products */
adminRouter.get('/products', asyncHandler(async (_req, res) => {
  const products = await productService.listProducts();
  res.json(products);
}));

/** POST /api/v1/admin/products — admin, editor */
adminRouter.post('/products', requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  res.status(201).json(product);
}));

/** PUT /api/v1/admin/products/:id — admin, editor */
adminRouter.put('/products/:id', requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(paramId(req), req.body);
  res.json(product);
}));

/** DELETE /api/v1/admin/products/:id — admin only */
adminRouter.delete('/products/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(paramId(req));
  res.json(result);
}));
