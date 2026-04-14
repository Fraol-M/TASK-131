import { z } from 'zod';
import { passwordSchema } from './password.js';

export const loginSchema = z.object({
  username: z.string().min(1).max(64).trim(),
  password: z.string().min(1),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const userScopeSchema = z.object({
  school: z.string().optional(),
  major: z.string().optional(),
  class: z.string().optional(),
  cohort: z.string().optional(),
});
