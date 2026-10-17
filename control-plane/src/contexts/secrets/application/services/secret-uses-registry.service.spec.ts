import { SecretUsesRegistry } from '@secrets/application/services/secret-uses-registry.service';
import { describe, expect, it } from 'vitest';

describe('SecretUsesRegistry', () => {
  it('gathers every use each registered user knows of', async () => {
    const registry = new SecretUsesRegistry();
    registry.register({
      usesOf: async ({ name }) => [`integration core/linear uses ${name}`],
    });
    registry.register({ usesOf: async () => [] });
    registry.register({
      usesOf: async ({ workspaceId }) => [`harness profile in ${workspaceId}`],
    });

    await expect(
      registry.of({ workspaceId: 'ws_1', name: 'LINEAR_API_KEY' }),
    ).resolves.toEqual([
      'integration core/linear uses LINEAR_API_KEY',
      'harness profile in ws_1',
    ]);
  });

  it('knows of no use before anything registers', async () => {
    await expect(
      new SecretUsesRegistry().of({ workspaceId: 'ws_1', name: 'A' }),
    ).resolves.toEqual([]);
  });
});
