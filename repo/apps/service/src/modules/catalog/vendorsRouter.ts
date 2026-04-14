import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { vendorSchema } from '@nexusorder/shared-validation';
import { vendorsService } from './vendorsService.js';

export const vendorsRouter = Router();

vendorsRouter.use(authMiddleware);

vendorsRouter.get(
  '/',
  requirePermission('vendors:read'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: await vendorsService.listVendors() });
    } catch (err) { next(err); }
  },
);

vendorsRouter.get(
  '/:id',
  requirePermission('vendors:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: await vendorsService.getVendor(req.params['id']!) });
    } catch (err) { next(err); }
  },
);

vendorsRouter.post(
  '/',
  requirePermission('vendors:create'),
  validate(vendorSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(201).json({ data: await vendorsService.createVendor(req.body as Parameters<typeof vendorsService.createVendor>[0]) });
    } catch (err) { next(err); }
  },
);
