import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { runStartupHealthCheck } from '../../updates/startupHealthChecker.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

export const systemRouter = Router();

// GET /api/system/health — unauthenticated liveness probe (Docker healthcheck / load balancer)
// Returns only ok/unhealthy status — no internal metadata
systemRouter.get('/health', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const health = await runStartupHealthCheck();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json({ data: { status: health.status } });
  } catch (err) { next(err); }
});

// GET /api/system/health/details — full diagnostics behind admin auth
systemRouter.get('/health/details', authMiddleware, requirePermission('system:read'), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const health = await runStartupHealthCheck();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json({ data: health });
  } catch (err) { next(err); }
});
