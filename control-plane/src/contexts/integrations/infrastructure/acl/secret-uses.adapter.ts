import type { IntegrationsUsingSecret } from '@integrations/application/services/integrations-using-secret.service';
import type {
  NamedSecret,
  SecretUse,
  SecretUser,
} from '@secrets/application/ports/secret-uses.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class IntegrationSecretUses implements SecretUser {
  constructor(private readonly using: IntegrationsUsingSecret) {}

  async usesOf(secret: NamedSecret): Promise<readonly SecretUse[]> {
    const addresses = await this.using.of(
      WorkspaceId.of(secret.workspaceId),
      SecretName.of(secret.name),
    );

    return addresses.map((address) => ({
      kind: 'integration',
      key: address.toString(),
    }));
  }
}
