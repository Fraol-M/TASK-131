import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { orderNoteSchema, orderTagSchema } from '@nexusorder/shared-validation';
import { orderRepository } from './orderRepository.js';
import { maskSku } from '../catalog/catalogService.js';
import type { Order, UserScope } from '@nexusorder/shared-types';

export const ordersRouter = Router();

ordersRouter.use(authMiddleware);

/**
 * Check whether an order's stored scope snapshot falls within a user's assigned scope.
 * An advisor/mentor with scope {school:'X'} may only access orders where the student
 * who placed the order also belongs to school 'X'.
 */
function isOrderInScope(order: Order, userScope: UserScope): boolean {
  const snap = order.userScopeSnapshot as Record<string, string | undefined> | undefined;
  if (!snap) return false; // no snapshot → deny for scoped roles (security: prevent bypass)
  if (userScope.school && snap['school'] !== userScope.school) return false;
  if (userScope.major && snap['major'] !== userScope.major) return false;
  if (userScope.class && snap['class'] !== userScope.class) return false;
  if (userScope.cohort && snap['cohort'] !== userScope.cohort) return false;
  return true;
}

/**
 * Central object-level access check used by GET /:id, POST /:id/notes, POST /:id/tags.
 * Returns true if the session user may access this order; false otherwise.
 */
function canAccessOrder(order: Order, session: NonNullable<Request['session']>): boolean {
  const { role, userId, scope } = session;
  if (role === 'department_admin') return true;
  if (role === 'student') return order.userId === userId;
  // faculty_advisor / corporate_mentor: scope-bounded access
  return isOrderInScope(order, scope);
}

// GET /api/orders — scope-filtered for advisors, own orders for students
ordersRouter.get(
  '/',
  requirePermission('orders:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role, userId, scope } = req.session!;
      const orders = role === 'student'
        ? await orderRepository.findByUser(userId)
        : await orderRepository.findByScope(scope);

      const enriched = await Promise.all(orders.map(async (order) => {
        const items = await orderRepository.getItems(order._id);
        return { ...order, itemCount: items.length };
      }));

      res.json({ data: enriched });
    } catch (err) { next(err); }
  },
);

// GET /api/orders/:id — returns order with embedded items, notes, tags
ordersRouter.get(
  '/:id',
  requirePermission('orders:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await orderRepository.findById(req.params['id']!);
      if (!canAccessOrder(order, req.session!)) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
      const [rawItems, notes, tags] = await Promise.all([
        orderRepository.getItems(order._id),
        orderRepository.getNotes(order._id),
        orderRepository.getTags(order._id),
      ]);
      const items = rawItems.map((item) => {
        const { sku: _raw, ...rest } = item;
        return { ...rest, skuMasked: maskSku(item.sku) };
      });
      res.json({ data: { ...order, items, notes, tags } });
    } catch (err) { next(err); }
  },
);

// POST /api/orders/:id/notes
ordersRouter.post(
  '/:id/notes',
  requirePermission('order_notes:create'),
  validate(orderNoteSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await orderRepository.findById(req.params['id']!);
      if (!canAccessOrder(order, req.session!)) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
      const { content } = req.body as { content: string };
      const note = await orderRepository.addNote({
        orderId: req.params['id']!,
        authorId: req.session!.userId,
        content,
        createdAt: new Date(),
      });
      res.status(201).json({ data: note });
    } catch (err) { next(err); }
  },
);

// POST /api/orders/:id/tags
ordersRouter.post(
  '/:id/tags',
  requirePermission('order_tags:create'),
  validate(orderTagSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await orderRepository.findById(req.params['id']!);
      if (!canAccessOrder(order, req.session!)) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
      const { tag } = req.body as { tag: string };
      const added = await orderRepository.addTag({
        orderId: req.params['id']!,
        tag,
        addedBy: req.session!.userId,
        addedAt: new Date(),
      });
      res.status(201).json({ data: added });
    } catch (err) { next(err); }
  },
);
