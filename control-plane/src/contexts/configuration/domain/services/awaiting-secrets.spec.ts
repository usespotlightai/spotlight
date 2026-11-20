import { awaitingSecrets } from '@configuration/domain/services/awaiting-secrets';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const settings = ProfileSettings.fromRaw({
  permissions: { allow: [], ask: [], deny: [] },
  mcpServers: [
    {
      name: 'linear',
      command: 'linear-mcp',
      args: [],
      env: { LINEAR_API_KEY: 'secret.LINEAR_API_KEY', LINEAR_TEAM: 'core' },
    },
  ],
  native: {},
  secrets: ['STAGING_VIEWER', 'GRAFANA_TOKEN'],
});

const awaitingOf = (...names: string[]) =>
  awaitingSecrets(
    settings,
    names.map((each) => SecretName.of(each)),
  ).map((each) => ({ path: each.path.segments, name: each.name.value }));

describe('the secrets a profile names that await a value', () => {
  it('are found where an MCP server’s env refers to them and where the profile names them', () => {
    expect(awaitingOf('LINEAR_API_KEY', 'GRAFANA_TOKEN')).toEqual([
      {
        path: ['mcpServers', 0, 'env', 'LINEAR_API_KEY'],
        name: 'LINEAR_API_KEY',
      },
      { path: ['secrets', 1], name: 'GRAFANA_TOKEN' },
    ]);
  });

  it('are none where every secret it names has a value', () => {
    expect(awaitingOf('SENTRY_TOKEN')).toEqual([]);
  });
});
