import { EgressRunnersRegistry } from '@secrets/application/services/egress-runners-registry.service';
import { describe, expect, it } from 'vitest';

describe('EgressRunnersRegistry', () => {
  it('finds a runner with egress when any registered source knows of one in the workspace', async () => {
    const registry = new EgressRunnersRegistry();
    registry.register({ anyIn: async () => false });
    registry.register({ anyIn: async (workspaceId) => workspaceId === 'ws_1' });

    await expect(registry.anyIn('ws_1')).resolves.toBe(true);
    await expect(registry.anyIn('ws_2')).resolves.toBe(false);
  });

  it('knows of no runner with egress before anything registers', async () => {
    await expect(new EgressRunnersRegistry().anyIn('ws_1')).resolves.toBe(
      false,
    );
  });
});
