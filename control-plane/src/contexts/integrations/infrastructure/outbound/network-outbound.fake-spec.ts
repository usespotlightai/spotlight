import type { NetworkOutbound } from '@integrations/infrastructure/outbound/network-outbound';

export const noNetwork = {
  run: async () => {
    throw new Error('This test sends nothing from the network.');
  },
} as unknown as NetworkOutbound;
