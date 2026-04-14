/**
 * @deprecated This is a legacy cart service with a divergent data model (embedded items
 * array with ObjectId-based catalog references). It is NOT used at runtime.
 * The active cart implementation uses orderRepository (UUID-based _id, separate
 * cart_items collection) and is consumed by cartsRouter.ts.
 * Do not use this module — it is retained only for historical reference and
 * will be removed in a future cleanup pass.
 */
import { getDb } from '../../persistence/mongoClient.js';
import { ObjectId } from 'mongodb';
import type { Cart, CartItem } from '@nexusorder/shared-types';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler.js';
import { createModuleLogger } from '@nexusorder/shared-logging';
import { blacklistPolicy } from '../catalog/blacklistPolicy.js';

const log = createModuleLogger('cartService');

/** @deprecated Use orderRepository cart methods + cartsRouter instead. */
export const cartService = {
  async getActive(userId: string): Promise<Cart | null> {
    const db = getDb();
    return db.collection<Cart>('carts').findOne({ userId, status: 'active' });
  },

  async addItem(userId: string, catalogItemId: string, quantity: number): Promise<Cart> {
    const db = getDb();

    // Check blacklist — blacklisted users cannot add to cart
    const isBlacklisted = await blacklistPolicy.isUserBlacklisted(userId);
    if (isBlacklisted) throw new ConflictError('User is blacklisted and cannot place orders');

    const item = await db.collection('catalog_items').findOne({ _id: new ObjectId(catalogItemId) });
    if (!item) throw new NotFoundError('Catalog item not found');
    if (item['isBlacklisted']) throw new ConflictError('This item is not available for ordering');

    let cart = await db.collection<Cart>('carts').findOne({ userId, status: 'active' });

    if (!cart) {
      const now = new Date();
      const newCart: Omit<Cart, '_id'> = {
        userId,
        status: 'active',
        items: [],
        createdAt: now,
        updatedAt: now,
      };
      const result = await db.collection<Omit<Cart, '_id'>>('carts').insertOne(newCart);
      cart = { ...newCart, _id: result.insertedId.toHexString() } as Cart;
    }

    const existingIdx = cart.items.findIndex((i) => i.catalogItemId === catalogItemId);

    if (existingIdx >= 0) {
      await db.collection<Cart>('carts').updateOne(
        { userId, status: 'active', [`items.${existingIdx}.catalogItemId`]: catalogItemId },
        { $inc: { [`items.${existingIdx}.quantity`]: quantity }, $set: { updatedAt: new Date() } },
      );
    } else {
      const cartItem: CartItem = {
        catalogItemId,
        name: String(item['name']),
        quantity,
        unitPrice: Number(item['price']),
        addedAt: new Date(),
      };
      await db.collection<Cart>('carts').updateOne(
        { userId, status: 'active' },
        { $push: { items: cartItem }, $set: { updatedAt: new Date() } },
      );
    }

    log.info({ userId, catalogItemId, quantity }, 'Item added to cart');

    return (await db.collection<Cart>('carts').findOne({ userId, status: 'active' })) as Cart;
  },

  async removeItem(userId: string, catalogItemId: string): Promise<Cart> {
    const db = getDb();
    await db.collection<Cart>('carts').updateOne(
      { userId, status: 'active' },
      { $pull: { items: { catalogItemId } }, $set: { updatedAt: new Date() } },
    );
    const cart = await db.collection<Cart>('carts').findOne({ userId, status: 'active' });
    if (!cart) throw new NotFoundError('No active cart');
    return cart;
  },

  async clearCart(userId: string): Promise<void> {
    const db = getDb();
    await db.collection<Cart>('carts').updateOne(
      { userId, status: 'active' },
      { $set: { status: 'closed', updatedAt: new Date() } },
    );
  },
};
