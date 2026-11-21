import { sandboxNotAllowed } from '@configuration/domain/services/sandbox-not-allowed';
import { KnownSecrets } from '@configuration/domain/value-objects/known-secrets.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const putting = ProfileSettings.fromRaw({
  permissions: { allow: [], ask: [], deny: [] },
  mcpServers: [],
  native: {},
  secrets: [],
  env: {
    GITHUB_APP_PRIVATE_KEY: 'DEV_GITHUB_APP_KEY',
    DATABASE_URL: 'DEV_DATABASE_URL',
    SENTRY_TOKEN: 'SENTRY_TOKEN',
  },
});

const APP_KEY = SecretName.of('DEV_GITHUB_APP_KEY');
const DATABASE = SecretName.of('DEV_DATABASE_URL');

describe('the secrets a profile puts in the sandbox but may not', () => {
  it('are the secrets the workspace has that do not allow the sandbox, each at its variable', () => {
    expect(
      sandboxNotAllowed(
        putting,
        KnownSecrets.of({
          existing: [APP_KEY, DATABASE],
          sandboxSecrets: [DATABASE],
        }),
      ).map(({ path, name }) => [path.segments, name.value]),
    ).toEqual([[['env', 'GITHUB_APP_PRIVATE_KEY'], 'DEV_GITHUB_APP_KEY']]);
  });

  it('leave a secret the workspace does not have to the missing secrets', () => {
    expect(
      sandboxNotAllowed(
        putting,
        KnownSecrets.of({ existing: [], sandboxSecrets: [] }),
      ),
    ).toEqual([]);
  });

  it('are none where every secret it puts there allows the sandbox', () => {
    expect(
      sandboxNotAllowed(
        putting,
        KnownSecrets.of({
          existing: [APP_KEY, DATABASE],
          sandboxSecrets: [APP_KEY, DATABASE],
        }),
      ),
    ).toEqual([]);
  });
});
