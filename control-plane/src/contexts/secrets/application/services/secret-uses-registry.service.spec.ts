import { SecretUsesRegistry } from '@secrets/application/services/secret-uses-registry.service';
import { describe, expect, it } from 'vitest';

describe('SecretUsesRegistry', () => {
  it('gathers every use each registered user knows of', async () => {
    const registry = new SecretUsesRegistry();
    registry.register({
      usesOf: ({ name }) =>
        Promise.resolve([
          {
            kind: 'integration',
            key: `core/linear uses ${name}`,
            exposes: false,
          },
        ]),
    });
    registry.register({ usesOf: () => Promise.resolve([]) });
    registry.register({
      usesOf: ({ workspaceId }) =>
        Promise.resolve([
          { kind: 'harness-profile', key: `in ${workspaceId}`, exposes: true },
        ]),
    });

    await expect(
      registry.of({ workspaceId: 'ws_1', name: 'LINEAR_API_KEY' }),
    ).resolves.toEqual([
      {
        kind: 'integration',
        key: 'core/linear uses LINEAR_API_KEY',
        exposes: false,
      },
      { kind: 'harness-profile', key: 'in ws_1', exposes: true },
    ]);
  });

  it('knows of no use before anything registers', async () => {
    await expect(
      new SecretUsesRegistry().of({ workspaceId: 'ws_1', name: 'A' }),
    ).resolves.toEqual([]);
  });
});
