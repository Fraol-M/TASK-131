import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { Order, OrderItem, OrderNote, OrderTag, Cart, CartItem, UserScope } from '@nexusorder/shared-types';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler.js';

export const orderRepository = {
  // ─── Orders ───────────────────────────────────────────────────────────────
  async findById(id: string): Promise<Order> {
    const order = await getDb().collection<Order>('orders').findOne({ _id: id } as { _id: string });
    if (!order) throw new NotFoundError('Order');
    return order;
  },

  async findByIdAndVersion(id: string, version: number): Promise<Order> {
    const order = await getDb().collection<Order>('orders').findOne({ _id: id, version } as { _id: string; version: number });
    if (!order) throw new ConflictError('Order was modified by another operation (optimistic lock)');
    return order;
  },

  async findByUser(userId: string): Promise<Order[]> {
    return getDb().collection<Order>('orders').find({ userId }).sort({ createdAt: -1 }).toArray();
  },

  async findByScope(scope: UserScope): Promise<Order[]> {
    const filter: Record<string, string> = {};
    if (scope.school) filter['userScopeSnapshot.school'] = scope.school;
    if (scope.major) filter['userScopeSnapshot.major'] = scope.major;
    if (scope.class) filter['userScopeSnapshot.class'] = scope.class;
    if (scope.cohort) filter['userScopeSnapshot.cohort'] = scope.cohort;
    return getDb().collection<Order>('orders').find(filter).sort({ createdAt: -1 }).toArray();
  },

  async insert(order: Order): Promise<void> {
    await getDb().collection<Order>('orders').insertOne(order as Order & { _id: string });
  },

  async updateState(
    id: string,
    version: number,
    update: Partial<Order>,
  ): Promise<void> {
    const result = await getDb().collection<Order>('orders').updateOne(
      { _id: id, version } as { _id: string; version: number },
      { $set: { ...update, version: version + 1, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      throw new ConflictError('Order state update failed — concurrent modification detected');
    }
  },

  // ─── Items ────────────────────────────────────────────────────────────────
  async getItems(orderId: string): Promise<OrderItem[]> {
    return getDb().collection<OrderItem>('order_items').find({ orderId }).toArray();
  },

  async insertItems(items: OrderItem[]): Promise<void> {
    if (items.length === 0) return;
    await getDb().collection<OrderItem>('order_items').insertMany(items as (OrderItem & { _id: string })[]);
  },

  // ─── Notes / Tags ─────────────────────────────────────────────────────────
  async getNotes(orderId: string): Promise<OrderNote[]> {
    return getDb().collection<OrderNote>('order_notes').find({ orderId }).sort({ createdAt: -1 }).toArray();
  },

  async addNote(note: Omit<OrderNote, '_id'>): Promise<OrderNote> {
    const doc: OrderNote & { _id: string } = { _id: randomUUID(), ...note };
    await getDb().collection<OrderNote>('order_notes').insertOne(doc);
    return doc;
  },

  async getTags(orderId: string): Promise<OrderTag[]> {
    return getDb().collection<OrderTag>('order_tags').find({ orderId }).toArray();
  },

  async addTag(tag: Omit<OrderTag, '_id'>): Promise<OrderTag> {
    const doc: OrderTag & { _id: string } = { _id: randomUUID(), ...tag };
    await getDb().collection<OrderTag>('order_tags').insertOne(doc);
    return doc;
  },

  // ─── Carts ────────────────────────────────────────────────────────────────
  async getCartByUser(userId: string): Promise<(Cart & { _id: string }) | null> {
    return getDb().collection<Cart>('carts').findOne({ userId }) as Promise<(Cart & { _id: string }) | null>;
  },

  async upsertCart(userId: string): Promise<Cart & { _id: string }> {
    const existing = await this.getCartByUser(userId);
    if (existing) return existing;
    const cart: Cart & { _id: string } = {
      _id: randomUUID(),
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await getDb().collection<Cart>('carts').insertOne(cart);
    return cart;
  },

  async getCartItems(cartId: string): Promise<CartItem[]> {
    return getDb().collection<CartItem>('cart_items').find({ cartId }).toArray();
  },

  async upsertCartItem(cartId: string, catalogItemId: string, quantity: number): Promise<void> {
    await getDb().collection<CartItem>('cart_items').updateOne(
      { cartId, catalogItemId },
      { $set: { quantity, addedAt: new Date() }, $setOnInsert: { _id: randomUUID(), cartId, catalogItemId } },
      { upsert: true },
    );
  },

  async removeCartItem(cartId: string, catalogItemId: string): Promise<void> {
    await getDb().collection<CartItem>('cart_items').deleteOne({ cartId, catalogItemId });
  },

  async clearCart(cartId: string): Promise<void> {
    await getDb().collection<CartItem>('cart_items').deleteMany({ cartId });
  },
};
