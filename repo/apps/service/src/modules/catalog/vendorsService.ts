import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { Vendor } from '@nexusorder/shared-types';
import { NotFoundError } from '../../middleware/errorHandler.js';

type VendorInput = Omit<Vendor, '_id' | 'createdAt' | 'updatedAt'>;

export const vendorsService = {
  async listVendors(): Promise<Vendor[]> {
    return getDb().collection<Vendor>('vendors').find({}).toArray();
  },

  async getVendor(id: string): Promise<Vendor> {
    const vendor = await getDb().collection<Vendor>('vendors').findOne({ _id: id } as { _id: string });
    if (!vendor) throw new NotFoundError('Vendor');
    return vendor;
  },

  async createVendor(data: VendorInput): Promise<Vendor> {
    const now = new Date();
    const vendor: Vendor & { _id: string } = { _id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await getDb().collection<Vendor>('vendors').insertOne(vendor);
    return vendor;
  },
};
