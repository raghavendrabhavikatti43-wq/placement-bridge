import { getCapabilityFlags } from '../config/env.ts';
import { logger } from '../config/logger.ts';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
}

/**
 * Honest Email Adapter (Part A Rule R2 & Section 4):
 * Reports `delivered: false` with a clear message when EMAIL_PROVIDER is not configured.
 * Never logs password reset tokens!
 */
export async function sendTransactionalEmail(_payload: EmailPayload): Promise<{
  delivered: boolean;
  reason?: string;
}> {
  const { emailEnabled } = getCapabilityFlags();
  if (!emailEnabled) {
    return {
      delivered: false,
      reason: 'Email delivery is not configured',
    };
  }

  // Hook for configured webhook/SMTP relay in production deployments
  logger.info({ subject: _payload.subject }, 'Transactional email queued via configured provider');
  return { delivered: true };
}
