import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import * as resourceService from '../services/resource.service.js';

export const adminRouter = Router();

// All admin routes require Supabase Auth JWT
adminRouter.use(authMiddleware);

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
    const resource = await resourceService.updateResource(req.params.id, req.body);
    res.json(resource);
  }),
);

/** PATCH /api/v1/admin/resources/:id/status */
adminRouter.patch(
  '/resources/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const resource = await resourceService.updateResourceStatus(req.params.id, status);
    res.json(resource);
  }),
);

/** DELETE /api/v1/admin/resources/:id */
adminRouter.delete(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    const result = await resourceService.deleteResource(req.params.id);
    res.json(result);
  }),
);

// ==========================================================================
// Multimedia (E2)
// ==========================================================================

adminRouter.post('/assets', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
}));

adminRouter.delete('/assets/:id', asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented — phase E2' });
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
// Navegacion (E2)
// ==========================================================================

adminRouter.put('/navigation/:menuSlug', asyncHandler(async (_req, res) => {
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
