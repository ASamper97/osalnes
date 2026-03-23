import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
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

/** PATCH /api/v1/admin/resources/:id/status — admin, editor, validador */
adminRouter.patch(
  '/resources/:id/status',
  requireRole('admin', 'editor', 'validador'),
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

/** POST /api/v1/admin/pages */
adminRouter.post('/pages', asyncHandler(async (req, res) => {
  const page = await pageService.createPage(req.body);
  res.status(201).json(page);
}));

/** PUT /api/v1/admin/pages/:id */
adminRouter.put('/pages/:id', asyncHandler(async (req, res) => {
  const page = await pageService.updatePage(paramId(req), req.body);
  res.json(page);
}));

/** PATCH /api/v1/admin/pages/:id/status */
adminRouter.patch('/pages/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const page = await pageService.updatePageStatus(paramId(req), status);
  res.json(page);
}));

/** DELETE /api/v1/admin/pages/:id */
adminRouter.delete('/pages/:id', asyncHandler(async (req, res) => {
  const result = await pageService.deletePage(paramId(req));
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

/** POST /api/v1/admin/relations */
adminRouter.post('/relations', asyncHandler(async (req, res) => {
  const relation = await relationService.createRelation(req.body);
  res.status(201).json(relation);
}));

/** PUT /api/v1/admin/relations/:id */
adminRouter.put('/relations/:id', asyncHandler(async (req, res) => {
  const relation = await relationService.updateRelation(paramId(req), req.body);
  res.json(relation);
}));

/** DELETE /api/v1/admin/relations/:id */
adminRouter.delete('/relations/:id', asyncHandler(async (req, res) => {
  const result = await relationService.deleteRelation(paramId(req));
  res.json(result);
}));

// ==========================================================================
// Documentos descargables
// ==========================================================================

/** POST /api/v1/admin/documents — upload document (multipart/form-data) */
adminRouter.post('/documents', upload.single('file'), asyncHandler(async (req, res) => {
  const file = (req as any).file;
  if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const entidadTipo = req.body.entidad_tipo || 'recurso_turistico';
  const entidadId = req.body.entidad_id;
  if (!entidadId) { res.status(400).json({ error: 'entidad_id is required' }); return; }

  const nombre = req.body.nombre ? JSON.parse(req.body.nombre) : undefined;
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

/** PUT /api/v1/admin/documents/:id */
adminRouter.put('/documents/:id', asyncHandler(async (req, res) => {
  const doc = await documentService.updateDocument(paramId(req), req.body);
  res.json(doc);
}));

/** DELETE /api/v1/admin/documents/:id */
adminRouter.delete('/documents/:id', asyncHandler(async (req, res) => {
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

/** POST /api/v1/admin/products */
adminRouter.post('/products', asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  res.status(201).json(product);
}));

/** PUT /api/v1/admin/products/:id */
adminRouter.put('/products/:id', asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(paramId(req), req.body);
  res.json(product);
}));

/** DELETE /api/v1/admin/products/:id */
adminRouter.delete('/products/:id', asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(paramId(req));
  res.json(result);
}));
