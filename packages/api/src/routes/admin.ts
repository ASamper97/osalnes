import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware } from '../middleware/auth.js';

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
    // E2: full create logic with validation
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

/** PUT /api/v1/admin/resources/:id */
adminRouter.put(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

/** PATCH /api/v1/admin/resources/:id/status */
adminRouter.patch(
  '/resources/:id/status',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

/** DELETE /api/v1/admin/resources/:id */
adminRouter.delete(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

// ==========================================================================
// Multimedia
// ==========================================================================

/** POST /api/v1/admin/assets */
adminRouter.post(
  '/assets',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

/** DELETE /api/v1/admin/assets/:id */
adminRouter.delete(
  '/assets/:id',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

// ==========================================================================
// Paginas
// ==========================================================================

/** POST /api/v1/admin/pages */
adminRouter.post(
  '/pages',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

/** PUT /api/v1/admin/pages/:id */
adminRouter.put(
  '/pages/:id',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

// ==========================================================================
// Exportaciones PID / Data Lake
// ==========================================================================

/** POST /api/v1/admin/exports/pid */
adminRouter.post(
  '/exports/pid',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

/** POST /api/v1/admin/exports/datalake */
adminRouter.post(
  '/exports/datalake',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

/** GET /api/v1/admin/exports/:jobId */
adminRouter.get(
  '/exports/:jobId',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

// ==========================================================================
// Navegacion
// ==========================================================================

/** PUT /api/v1/admin/navigation/:menuSlug */
adminRouter.put(
  '/navigation/:menuSlug',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

// ==========================================================================
// Usuarios (solo admin)
// ==========================================================================

/** GET /api/v1/admin/users */
adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);

/** POST /api/v1/admin/users */
adminRouter.post(
  '/users',
  asyncHandler(async (req, res) => {
    res.status(501).json({ error: 'Not implemented — phase E2' });
  }),
);
