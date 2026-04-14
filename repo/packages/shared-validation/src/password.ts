import { z } from 'zod';

// Password policy: ≥12 chars, at least one number, at least one symbol
const PASSWORD_MIN_LENGTH = 12;
const HAS_NUMBER = /\d/;
const HAS_SYMBOL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine((v) => HAS_NUMBER.test(v), 'Password must contain at least one number')
  .refine((v) => HAS_SYMBOL.test(v), 'Password must contain at least one symbol');

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const result = passwordSchema.safeParse(password);
  if (result.success) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: result.error.errors.map((e) => e.message),
  };
}
