import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { addToCartSchema } from '@nexusorder/shared-validation';
import { orderRepository } from './orderRepository.js';
import { checkoutService } from './checkoutService.js';
import { maskSku, isItemInScope } from '../catalog/catalogService.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { BusinessRuleError } from '../../middleware/errorHandler.js';
import { getDb } from '../../persistence/mongoClient.js';
import type { CatalogItem } from '@nexusorder/shared-types';

export const cartsRouter = Router();

cartsRouter.use(authMiddleware);

// GET /api/carts/active  (renderer alias — returns cart with enriched items)
// GET /api/carts/me      (canonical endpoint)
const getActiveCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cart = await orderRepository.getCartByUser(req.session!.userId);
    if (!cart) { res.json({ data: null }); return; }

    const cartItems = await orderRepository.getCartItems(cart._id);

    // Enrich items with catalog data
    // catalog_items use UUID string _id — do NOT wrap in ObjectId
    const db = (await import('../../persistence/mongoClient.js')).getDb();

    const enriched = await Promise.all(cartItems.map(async (item) => {
      let catalogDoc: Record<string, unknown> | null = null;
      try {
        catalogDoc = await db.collection('catalog_items').findOne({ _id: item.catalogItemId }) as Record<string, unknown> | null;
      } catch { /* ignore */ }
      return {
        _id: item._id,
        catalogItemId: item.catalogItemId,
        name: catalogDoc?.['name'] ?? 'Unknown',
        skuMasked: maskSku(catalogDoc?.['sku'] as string ?? ''),
        quantity: item.quantity,
        unitPrice: catalogDoc?.['unitPrice'] ?? 0,
        lineTotal: item.quantity * (catalogDoc?.['unitPrice'] as number ?? 0),
      };
    }));

    const subtotal = enriched.reduce((s, i) => s + i.lineTotal, 0);
    res.json({ data: { _id: cart._id, userId: cart.userId, items: enriched, subtotal, currency: 'CNY' } });
  } catch (err) { next(err); }
};

cartsRouter.get('/active', getActiveCart);
cartsRouter.get('/me', getActiveCart);

// POST /api/carts/items
cartsRouter.post(
  '/items',
  requirePermission('cart:create'),
  validate(addToCartSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { catalogItemId, quantity } = req.body as { catalogItemId: string; quantity: number };

      // Enforce scope eligibility before allowing the item into the cart
      const catalogItem = await getDb()
        .collection<CatalogItem>('catalog_items')
        .findOne({ _id: catalogItemId } as Record<string, unknown>);
      if (!catalogItem || !catalogItem.isAvailable) {
        throw new BusinessRuleError('ITEM_UNAVAILABLE', `Catalog item ${catalogItemId} is not available`);
      }
      if (!isItemInScope(catalogItem, req.session!.scope)) {
        await emitAuditEvent({
          action: 'cart.scope_violation',
          userId: req.session!.userId,
          meta: { catalogItemId, scope: req.session!.scope },
        });
        throw new BusinessRuleError('ITEM_OUT_OF_SCOPE', 'Item is not available for your scope');
      }

      const cart = await orderRepository.upsertCart(req.session!.userId);
      await orderRepository.upsertCartItem(cart._id, catalogItemId, quantity);
      res.status(201).json({ data: { message: 'Item added to cart' } });
    } catch (err) { next(err); }
  },
);

// DELETE /api/carts/items/:catalogItemId
cartsRouter.delete(
  '/items/:catalogItemId',
  requirePermission('cart:delete'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cart = await orderRepository.getCartByUser(req.session!.userId);
      if (cart) await orderRepository.removeCartItem(cart._id, req.params['catalogItemId']!);
      res.json({ data: { message: 'Item removed from cart' } });
    } catch (err) { next(err); }
  },
);

// POST /api/carts/checkout  (Ctrl+Enter triggers this in the renderer)
cartsRouter.post(
  '/checkout',
  requirePermission('orders:checkout'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await checkoutService.checkout(req.session!.userId, req.session!.scope);
      res.status(201).json({ data: order });
    } catch (err) {
      // Throttle rejection: emit audit event
      if ((err as { code?: string }).code === 'CHECKOUT_THROTTLED') {
        await emitAuditEvent({
          action: 'cart.checkout_throttled',
          userId: req.session?.userId,
        });
      }
      next(err);
    }
  },
);
