import { z } from 'zod';
import { userScopeSchema } from './auth.js';

export const vendorSchema = z.object({
  name: z.string().min(1).max(200),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const catalogItemSchema = z.object({
  vendorId: z.string(),
  name: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  sku: z.string().min(1).max(100),
  unitPrice: z.number().positive(),
  currency: z.string().length(3),
  taxRate: z.number().min(0).max(1),
  stock: z.number().int().min(0),
  isAvailable: z.boolean().default(true),
  eligibleScopes: z.array(userScopeSchema).default([]),
});

export const addToCartSchema = z.object({
  catalogItemId: z.string(),
  quantity: z.number().int().positive().max(100),
});
