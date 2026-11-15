import { OAuth2ClientSecretRefusedError } from '@integrations/application/errors/oauth2-client-secret-refused.error';
import { OAuth2ClientSecrets } from '@integrations/infrastructure/acl/oauth2-client-secrets.adapter';
import { injecting } from '@integrations/integrations.secrets.fake-spec';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

describe('OAuth2ClientSecrets', () => {
  it('reads the client secret for the token endpoint it is bound to', async () => {
    const { injection } = injecting({
      TRACKER_CLIENT_SECRET: { value: 'own-secret', host: 'tracker.example' },
    });

    await expect(
      new OAuth2ClientSecrets(injection).sentTo(
        WorkspaceId.of('ws_1'),
        SecretName.of('TRACKER_CLIENT_SECRET'),
        'https://tracker.example/oauth/token',
      ),
    ).resolves.toBe('own-secret');
  });

  it('never reads it for a token endpoint on another host', async () => {
    const { injection } = injecting({
      TRACKER_CLIENT_SECRET: { value: 'own-secret', host: 'tracker.example' },
    });

    await expect(
      new OAuth2ClientSecrets(injection).sentTo(
        WorkspaceId.of('ws_1'),
        SecretName.of('TRACKER_CLIENT_SECRET'),
        'https://evil.example/token',
      ),
    ).rejects.toBeInstanceOf(OAuth2ClientSecretRefusedError);
  });
});
