import { z } from 'zod';
import { passwordSchema } from './password.js';
import { userScopeSchema } from './auth.js';

export const userRoleSchema = z.enum([
  'student',
  'faculty_advisor',
  'corporate_mentor',
  'department_admin',
]);

export const createUserSchema = z.object({
  username: z.string().min(3).max(64).trim(),
  password: passwordSchema,
  role: userRoleSchema,
  scope: userScopeSchema,
});

// userId comes from the URL parameter (:id), not the request body
export const updateBlacklistSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const fingerprintConsentSchema = z.object({
  consentGiven: z.boolean(),
});

// fingerprintHash must be a 64-character lowercase hex string (SHA-256 digest)
export const fingerprintSubmitSchema = z.object({
  fingerprintHash: z.string().regex(/^[0-9a-f]{64}$/, 'fingerprintHash must be a SHA-256 hex digest'),
});
