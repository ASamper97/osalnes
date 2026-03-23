import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { graphqlHandler } from './graphql/handler.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';

export const app = express();

// ---------------------------------------------------------------------------
// Middleware global
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: '5mb' }));
app.use(requestLogger);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Rutas REST publicas  (/api/v1/...)
// ---------------------------------------------------------------------------
app.use('/api/v1', publicRouter);

// ---------------------------------------------------------------------------
// Rutas REST de gestion (/api/v1/admin/...)
// ---------------------------------------------------------------------------
app.use('/api/v1/admin', adminRouter);

// ---------------------------------------------------------------------------
// GraphQL endpoint compatible PID SEGITTUR
// ---------------------------------------------------------------------------
app.use('/graphql', graphqlHandler);

// ---------------------------------------------------------------------------
// Error handler global
// ---------------------------------------------------------------------------
app.use(errorHandler);
