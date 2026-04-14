import { validatePassword } from '@nexusorder/shared-validation';

export { validatePassword };

/**
 * Throws a ValidationError-compatible message if the password does not meet policy.
 * Policy: ≥12 characters, at least one number, at least one symbol.
 */
export function assertValidPassword(password: string): void {
  const result = validatePassword(password);
  if (!result.valid) {
    throw new Error(result.errors.join('; '));
  }
}
