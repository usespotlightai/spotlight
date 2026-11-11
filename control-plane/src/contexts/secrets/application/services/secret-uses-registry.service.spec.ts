import { SecretUsesRegistry } from '@secrets/application/services/secret-uses-registry.service';
import { describe, expect, it } from 'vitest';

describe('SecretUsesRegistry', () => {
  it('gathers every use each registered user knows of', async () => {
    const registry = new SecretUsesRegistry();
    registry.register({
      usesOf: async ({ name }) => [
        { kind: 'integration', key: `core/linear uses ${name}` },
      ],
    });
    registry.register({ usesOf: async () => [] });
    registry.register({
      usesOf: async ({ workspaceId }) => [
        { kind: 'harness-profile', key: `in ${workspaceId}` },
      ],
    });

    await expect(
      registry.of({ workspaceId: 'ws_1', name: 'LINEAR_API_KEY' }),
    ).resolves.toEqual([
      { kind: 'integration', key: 'core/linear uses LINEAR_API_KEY' },
      { kind: 'harness-profile', key: 'in ws_1' },
    ]);
  });

  it('knows of no use before anything registers', async () => {
    await expect(
      new SecretUsesRegistry().of({ workspaceId: 'ws_1', name: 'A' }),
    ).resolves.toEqual([]);
  });
});
