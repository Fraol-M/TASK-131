import type { UserScope } from './auth.js';

export interface Vendor {
  _id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogItem {
  _id: string;
  vendorId: string;
  name: string;
  description?: string;
  sku: string;
  unitPrice: number;
  currency: string;
  taxRate: number; // percentage, e.g. 0.08 for 8%
  stock: number;
  isAvailable: boolean;
  eligibleScopes: UserScope[]; // empty = available to all
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Grid-safe view — sensitive price fragments masked
export interface CatalogItemMasked extends Omit<CatalogItem, 'sku'> {
  skuMasked: string; // last 4 chars visible
}
