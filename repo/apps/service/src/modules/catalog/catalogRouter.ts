import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { catalogItemSchema } from '@nexusorder/shared-validation';
import { catalogService } from './catalogService.js';

export const catalogRouter = Router();

catalogRouter.use(authMiddleware);

// GET /api/catalog — scope-filtered listing
catalogRouter.get(
  '/',
  requirePermission('catalog:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = req.session!.scope;
      const search = req.query['q'] as string | undefined;
      const items = await catalogService.listItems(scope, search);
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/catalog/:id
catalogRouter.get(
  '/:id',
  requirePermission('catalog:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const item = await catalogService.getItem(req.params['id']!, req.session!.scope);
      res.json({ data: item });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/catalog — admin only
catalogRouter.post(
  '/',
  requirePermission('catalog:manage_catalog'),
  validate(catalogItemSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const item = await catalogService.createItem(req.body as Parameters<typeof catalogService.createItem>[0]);
      res.status(201).json({ data: item });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/catalog/:id — admin only
catalogRouter.patch(
  '/:id',
  requirePermission('catalog:manage_catalog'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const item = await catalogService.updateItem(req.params['id']!, req.body as Partial<Parameters<typeof catalogService.createItem>[0]>);
      res.json({ data: item });
    } catch (err) {
      next(err);
    }
  },
);
