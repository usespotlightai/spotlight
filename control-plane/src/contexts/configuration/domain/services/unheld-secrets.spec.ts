import { unheldSecrets } from '@configuration/domain/services/unheld-secrets';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const wearing = ProfileSettings.written({
  permissions: { allow: [], ask: [], deny: [] },
  mcpServers: [
    {
      name: 'linear',
      command: 'npx',
      args: [],
      env: { LINEAR_API_KEY: 'secret.LINEAR_API_KEY', LINEAR_TEAM: 'core' },
    },
    {
      name: 'sentry',
      command: 'npx',
      args: [],
      env: { SENTRY_TOKEN: 'secret.SENTRY_TOKEN' },
    },
  ],
  native: {},
});

describe('a profile’s worn secrets', () => {
  it('are the secrets its MCP servers’ env refers to, where each is named', () => {
    expect(
      wearing.wornSecrets.map(({ at, secret }) => [at, secret.value]),
    ).toEqual([
      [['mcpServers', 0, 'env', 'LINEAR_API_KEY'], 'LINEAR_API_KEY'],
      [['mcpServers', 1, 'env', 'SENTRY_TOKEN'], 'SENTRY_TOKEN'],
    ]);
    expect(wearing.wears(SecretName.of('SENTRY_TOKEN'))).toBe(true);
    expect(wearing.wears(SecretName.of('LINEAR_TEAM'))).toBe(false);
  });

  it('are unheld where the workspace does not hold them', () => {
    expect(
      unheldSecrets(wearing, [SecretName.of('LINEAR_API_KEY')]).map(
        (each) => each.secret.value,
      ),
    ).toEqual(['SENTRY_TOKEN']);
    expect(
      unheldSecrets(wearing, [
        SecretName.of('LINEAR_API_KEY'),
        SecretName.of('SENTRY_TOKEN'),
      ]),
    ).toEqual([]);
  });
});
