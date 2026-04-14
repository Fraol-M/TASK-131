import { usersService } from '../users/usersService.js';
import { BusinessRuleError } from '../../middleware/errorHandler.js';

/**
 * Enforce the blacklist checkout block rule.
 * Blacklisted users can browse the catalog but are blocked from checkout.
 * Call this at the start of checkoutService.checkout().
 */
export async function assertNotBlacklisted(userId: string): Promise<void> {
  const blacklisted = await usersService.isBlacklisted(userId);
  if (blacklisted) {
    throw new BusinessRuleError(
      'USER_BLACKLISTED',
      'Your account is not permitted to place orders. Please contact an administrator.',
    );
  }
}
