import { missingSecrets } from '@configuration/domain/services/missing-secrets';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const referring = ProfileSettings.written({
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

describe('a profile’s injected secrets', () => {
  it('are the secrets its MCP servers’ env refers to, where each is named', () => {
    expect(
      referring.secretReferences.map(({ path, name }) => [path.segments, name]),
    ).toEqual([
      [['mcpServers', 0, 'env', 'LINEAR_API_KEY'], 'LINEAR_API_KEY'],
      [['mcpServers', 1, 'env', 'SENTRY_TOKEN'], 'SENTRY_TOKEN'],
    ]);
    expect(referring.uses(SecretName.of('SENTRY_TOKEN'))).toBe(true);
    expect(referring.uses(SecretName.of('LINEAR_TEAM'))).toBe(false);
  });

  it('are missing where the workspace does not have them', () => {
    expect(
      missingSecrets(referring, [SecretName.of('LINEAR_API_KEY')]).map(
        (each) => each.name,
      ),
    ).toEqual(['SENTRY_TOKEN']);
    expect(
      missingSecrets(referring, [
        SecretName.of('LINEAR_API_KEY'),
        SecretName.of('SENTRY_TOKEN'),
      ]),
    ).toEqual([]);
  });
});
