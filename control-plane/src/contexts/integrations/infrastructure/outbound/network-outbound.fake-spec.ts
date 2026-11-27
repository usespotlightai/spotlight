import type { NetworkOutbound } from '@integrations/infrastructure/outbound/network-outbound';
import { partial } from '@shared-kernel/domain/partial.fake-spec';

export const noNetwork = partial<NetworkOutbound>({
  run: async () => {
    throw new Error('This test sends nothing from the network.');
  },
});
