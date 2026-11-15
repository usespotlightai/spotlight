import { OAuth2ClientSecretRefusedError } from '@integrations/application/errors/oauth2-client-secret-refused.error';
import type { OAuth2ClientSecretsPort } from '@integrations/application/ports/oauth2-client-secrets.port';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class OAuth2ClientSecrets implements OAuth2ClientSecretsPort {
  constructor(private readonly injection: SecretInjectionPort) {}

  async sentTo(
    workspaceId: WorkspaceId,
    secret: SecretName,
    url: string,
  ): Promise<string> {
    const [injected] = (
      await this.injection
        .forSpotlight({
          workspaceId: workspaceId.value,
          secrets: [secret.value],
          url,
        })
        .catch((error: unknown) => {
          if (error instanceof DomainError && error.isRefusal()) {
            throw new OAuth2ClientSecretRefusedError(secret.value, error);
          }

          throw error;
        })
    ).injected;

    if (!injected) {
      throw new InconsistentStateError(
        'secret',
        `${secret.value} was not injected for its token endpoint`,
      );
    }

    return injected.bare.revealed();
  }
}
