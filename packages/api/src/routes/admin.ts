import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import * as resourceService from '../services/resource.service.js';
import * as mediaService from '../services/media.service.js';
import * as categoryService from '../services/category.service.js';
import * as navigationService from '../services/navigation.service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const adminRouter = Router();

// All admin routes require Supabase Auth JWT
adminRouter.use(authMiddleware);

/** Helper — Express @types may widen params to string | string[] */
function paramId(req: { params: Record<string, unknown> }, key = 'id'): string {
  return req.params[key] as string;
}

// ==========================================================================
// CRUD Recursos
// ==========================================================================

/** POST /api/v1/admin/resources */
adminRouter.post(
  '/resources',
  asyncHandler(async (req, res) => {
    const resource = await resourceService.createResource(req.body);
    res.status(201).json(resource);
  }),
);

/** PUT /api/v1/admin/resources/:id */
adminRouter.put(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    const resource = await resourceService.updateResource(paramId(req), req.body);
    res.json(resource);
  }),
);

/** PATCH /api/v1/admin/resources/:id/status */
adminRouter.patch(
  '/resources/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const resource = await resourceService.updateResourceStatus(paramId(req), status);
    res.json(resource);
  }),
);

/** DELETE /api/v1/admin/resources/:id */
adminRouter.delete(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    const result = await resourceService.deleteResource(paramId(req));
    res.json(result);
  }),
);

// ==========================================================================
// Multimedia
// ==========================================================================

/** POST /api/v1/admin/assets — upload file (multipart/form-data) */
adminRouter.post('/assets', upload.single('file'), asyncHandler(async (req, res) => {
  const file = (req as any).file;
  if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

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

/** DELETE /api/v1/admin/assets/:id */
adminRouter.delete('/assets/:id', asyncHandler(async (req, res) => {
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

/** POST /api/v1/admin/categories */
adminRouter.post('/categories', asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  res.status(201).json(category);
}));

/** PUT /api/v1/admin/categories/:id */
adminRouter.put('/categories/:id', asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(paramId(req), req.body);
  res.json(category);
}));

/** DELETE /api/v1/admin/categories/:id */
adminRouter.delete('/categories/:id', asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(paramId(req));
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

/** POST /api/v1/admin/navigation */
adminRouter.post('/navigation', asyncHandler(async (req, res) => {
  const item = await navigationService.createNavItem(req.body);
  res.status(201).json(item);
}));

/** PUT /api/v1/admin/navigation/:id */
adminRouter.put('/navigation/:id', asyncHandler(async (req, res) => {
  const item = await navigationService.updateNavItem(paramId(req), req.body);
  res.json(item);
}));

/** DELETE /api/v1/admin/navigation/:id */
adminRouter.delete('/navigation/:id', asyncHandler(async (req, res) => {
  const result = await navigationService.deleteNavItem(paramId(req));
  res.json(result);
}));

/** PATCH /api/v1/admin/navigation/reorder/:menuSlug */
adminRouter.patch('/navigation/reorder/:menuSlug', asyncHandler(async (req, res) => {
  const result = await navigationService.reorderMenu(paramId(req, 'menuSlug'), req.body.items);
  res.json(result);
}));

// ==========================================================================
// Paginas (E2)
// ==========================================================================

adminRouter.post('/pages', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
}));

adminRouter.put('/pages/:id', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
}));

// ==========================================================================
// Exportaciones (E2)
// ==========================================================================

adminRouter.post('/exports/pid', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
}));

adminRouter.post('/exports/datalake', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
}));

adminRouter.get('/exports/:jobId', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
}));

// ==========================================================================
// Usuarios (E2)
// ==========================================================================

adminRouter.get('/users', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
}));

adminRouter.post('/users', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
}));
