import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { createRuleSchema, ruleSimulationSchema } from '@nexusorder/shared-validation';
import { ruleService } from './ruleService.js';
import { simulationEngine } from './simulationEngine.js';

export const rulesRouter = Router();

rulesRouter.use(authMiddleware);

// ─── Static routes MUST be registered before /:id to avoid shadowing ──────────

// GET /api/rules
rulesRouter.get('/', requirePermission('rules:read'), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ data: await ruleService.listRules() }); } catch (err) { next(err); }
});

// GET /api/rules/conflicts — returns flat list of RuleConflict[]
rulesRouter.get('/conflicts', requirePermission('rules:read'), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conflicts } = await ruleService.detectAndGetConflicts();
    res.json({ data: conflicts });
  } catch (err) { next(err); }
});

// GET /api/rules/conflicts/all — returns full { conflicts, cycles } object
rulesRouter.get('/conflicts/all', requirePermission('rules:read'), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ data: await ruleService.detectAndGetConflicts() }); } catch (err) { next(err); }
});

// POST /api/rules
rulesRouter.post('/', requirePermission('rules:create'), validate(createRuleSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rule = await ruleService.createRule(req.body as Parameters<typeof ruleService.createRule>[0], req.session!.userId);
    res.status(201).json({ data: rule });
  } catch (err) { next(err); }
});

// POST /api/rules/simulations
rulesRouter.post('/simulations', requirePermission('rule_simulations:create'), validate(ruleSimulationSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ruleId, historicalOrderIds } = req.body as { ruleId: string; historicalOrderIds: string[] };
    const rule = await ruleService.getRule(ruleId);
    const simulation = await simulationEngine.simulate({ rule, historicalOrderIds, simulatedBy: req.session!.userId });
    res.status(201).json({ data: simulation });
  } catch (err) { next(err); }
});

// ─── Dynamic :id routes after all static paths ────────────────────────────────

// GET /api/rules/:id
rulesRouter.get('/:id', requirePermission('rules:read'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ data: await ruleService.getRule(req.params['id']!) }); } catch (err) { next(err); }
});

// PATCH /api/rules/:id
rulesRouter.patch('/:id', requirePermission('rules:update'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rule = await ruleService.updateRule(req.params['id']!, req.body as Partial<Parameters<typeof ruleService.updateRule>[1]>, req.session!.userId);
    res.json({ data: rule });
  } catch (err) { next(err); }
});

// POST /api/rules/:id/activate
rulesRouter.post('/:id/activate', requirePermission('rules:update'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ data: await ruleService.activateRule(req.params['id']!, req.session!.userId) }); } catch (err) { next(err); }
});

// POST /api/rules/:id/deactivate
rulesRouter.post('/:id/deactivate', requirePermission('rules:update'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ data: await ruleService.deactivateRule(req.params['id']!, req.session!.userId) }); } catch (err) { next(err); }
});
