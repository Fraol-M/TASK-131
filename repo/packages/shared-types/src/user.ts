import type { UserRole, UserScope } from './auth.js';

export interface User {
  _id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  scope: UserScope;
  isBlacklisted: boolean;
  blacklistReason?: string;
  deviceFingerprintConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublic {
  _id: string;
  username: string;
  role: UserRole;
  scope: UserScope;
  isBlacklisted: boolean;
  createdAt: Date;
}

export interface RolePermission {
  _id: string;
  role: UserRole;
  resource: string;
  actions: string[];
}

export interface DeviceConsent {
  _id: string;
  userId: string;
  consentGiven: boolean;
  consentAt: Date;
  revokedAt?: Date;
}

export interface DeviceFingerprint {
  _id: string;
  userId: string;
  fingerprintHash: string; // hashed hardware + OS attributes — never raw source
  registeredAt: Date;
}

export interface Blacklist {
  _id: string;
  userId: string;
  reason: string;
  addedBy: string;
  addedAt: Date;
  removedAt?: Date;
  removedBy?: string;
}
