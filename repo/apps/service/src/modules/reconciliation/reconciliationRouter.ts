import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { reconciliationExceptionRepairSchema } from '@nexusorder/shared-validation';
import { reconciliationService } from './reconciliationService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

export const reconciliationRouter = Router();

reconciliationRouter.use(authMiddleware);

// GET /api/payments/reconciliation — list recent reconciliation rows
reconciliationRouter.get(
  '/',
  requirePermission('reconciliation:reconcile'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rows = await reconciliationService.listRows();
      res.json({ data: rows });
    } catch (err) { next(err); }
  },
);

// POST /api/payments/reconciliation/import
reconciliationRouter.post(
  '/import',
  requirePermission('reconciliation:reconcile'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'CSV file is required' } });
        return;
      }
      const result = await reconciliationService.importCsv({
        fileBuffer: req.file.buffer,
        filename: req.file.originalname,
        importedBy: req.session!.userId,
      });
      res.status(201).json({ data: result });
    } catch (err) { next(err); }
  },
);

// POST /api/payments/reconciliation/flag-unreconciled
// Admin marks a `paid` intent as `paid_unreconciled` when it was omitted from a merchant batch
reconciliationRouter.post(
  '/flag-unreconciled',
  requirePermission('reconciliation:repair_exception'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { paymentIntentId, note } = req.body as { paymentIntentId: string; note?: string };
      if (!paymentIntentId) {
        res.status(400).json({ error: { code: 'REQUIRED', message: 'paymentIntentId is required' } });
        return;
      }
      if (!note || note.trim() === '') {
        res.status(400).json({ error: { code: 'REQUIRED', message: 'note is required' } });
        return;
      }
      await reconciliationService.flagUnreconciled({
        paymentIntentId,
        adminId: req.session!.userId,
        note,
      });
      res.json({ data: { message: 'Payment intent flagged as paid_unreconciled' } });
    } catch (err) { next(err); }
  },
);

// POST /api/payments/reconciliation/repair
reconciliationRouter.post(
  '/repair',
  requirePermission('reconciliation:repair_exception'),
  validate(reconciliationExceptionRepairSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { paymentIntentId, note } = req.body as { paymentIntentId: string; note: string };
      await reconciliationService.repairException({
        paymentIntentId,
        note,
        adminId: req.session!.userId,
      });
      res.json({ data: { message: 'Exception repaired' } });
    } catch (err) { next(err); }
  },
);
