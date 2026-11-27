import type { OutboundLimitsPort } from '@integrations/application/ports/outbound-limits.port';

export const unlimited: OutboundLimitsPort = {
  perSecond: 50,
  take: async () => true,
};
