import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { getDb } from '../../persistence/mongoClient.js';
import type { Order, Rule, User } from '@nexusorder/shared-types';

export const searchRouter = Router();

// All authenticated roles have orders:read; this gate is the route-level RBAC
// anchor consistent with stated middleware policy. Per-type access (rules, users)
// is further restricted inside the handler by role branching.
searchRouter.use(authMiddleware);
searchRouter.use(requirePermission('orders:read'));

// GET /api/search?q=...&type=orders|rules|users
// Scope-filtered: results filtered to user's scope
searchRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = (req.query['q'] as string ?? '').trim();
    const type = req.query['type'] as string | undefined;
    const { role, scope, userId } = req.session!;

    if (!q || q.length < 2) {
      res.json({ data: { orders: [], rules: [], users: [] } });
      return;
    }

    const results: Record<string, unknown[]> = {};

    if (!type || type === 'orders') {
      const orderFilter: Record<string, unknown> = { $text: { $search: q } };
      if (role === 'student') orderFilter['userId'] = userId;
      else {
        if (scope.school) orderFilter['userScopeSnapshot.school'] = scope.school;
        if (scope.major) orderFilter['userScopeSnapshot.major'] = scope.major;
        if (scope.class) orderFilter['userScopeSnapshot.class'] = scope.class;
        if (scope.cohort) orderFilter['userScopeSnapshot.cohort'] = scope.cohort;
      }
      results['orders'] = await getDb().collection<Order>('orders')
        .find(orderFilter, { projection: { score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(20)
        .toArray();
    }

    if ((!type || type === 'rules') && (role === 'faculty_advisor' || role === 'department_admin')) {
      results['rules'] = await getDb().collection<Rule>('rules')
        .find({ $text: { $search: q } })
        .limit(20)
        .toArray();
    }

    if ((!type || type === 'users') && role === 'department_admin') {
      results['users'] = await getDb().collection<User>('users')
        .find({ username: { $regex: q, $options: 'i' } }, { projection: { passwordHash: 0 } })
        .limit(20)
        .toArray();
    }

    res.json({ data: results });
  } catch (err) { next(err); }
});
