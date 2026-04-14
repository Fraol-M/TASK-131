import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { reasonCodeService } from './reasonCodeService.js';

export const reasonCodeRouter = Router();

reasonCodeRouter.use(authMiddleware);

const createReasonCodeSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric/underscore'),
  label: z.string().min(1).max(200),
  applicableTo: z.array(z.enum(['return', 'refund', 'exchange'])).min(1),
});

const updateReasonCodeSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  applicableTo: z.array(z.enum(['return', 'refund', 'exchange'])).min(1).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/reason-codes — list all reason codes (any authenticated user can view)
reasonCodeRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const codes = await reasonCodeService.list();
      res.json({ data: codes });
    } catch (err) { next(err); }
  },
);

// POST /api/reason-codes — admin creates a reason code
reasonCodeRouter.post(
  '/',
  requirePermission('after_sales:manage_reason_codes'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createReasonCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION', message: parsed.error.message } });
        return;
      }
      const rc = await reasonCodeService.create({
        ...parsed.data,
        adminId: req.session!.userId,
      });
      res.status(201).json({ data: rc });
    } catch (err) { next(err); }
  },
);

// PATCH /api/reason-codes/:id — admin updates label, applicableTo, or isActive
reasonCodeRouter.patch(
  '/:id',
  requirePermission('after_sales:manage_reason_codes'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateReasonCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION', message: parsed.error.message } });
        return;
      }
      const rc = await reasonCodeService.update({
        id: req.params['id']!,
        ...parsed.data,
        adminId: req.session!.userId,
      });
      res.json({ data: rc });
    } catch (err) { next(err); }
  },
);
