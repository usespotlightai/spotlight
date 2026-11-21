import type {
  BoundSecretShape,
  BoundSecretsPort,
} from '@secrets/application/ports/bound-secrets.port';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import { SecretBinding } from '@secrets/domain/value-objects/secret-binding.vo';
import { allowsSandboxes } from '@secrets/domain/value-objects/secret-sandbox.vo';
import { SecretValueOrigin } from '@secrets/domain/value-objects/secret-value-origin.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class BoundSecrets implements BoundSecretsPort {
  constructor(private readonly secrets: SecretResourcesPort) {}

  async boundIn(
    workspaceId: string,
    names: readonly string[],
  ): Promise<readonly BoundSecretShape[]> {
    if (names.length === 0) {
      return [];
    }

    const found = await this.secrets.namedIn(
      WorkspaceId.of(workspaceId),
      names,
    );

    return found.map((each) => {
      const name = SecretName.of(each.name);

      return {
        name: name.value,
        bindings: each.bindings.map((written) => {
          const binding = SecretBinding.of(written);

          return {
            host: binding.host.value,
            location: binding.target.location,
            name: binding.target.name,
            sent: binding.standInSent(name),
          };
        }),
        awaitingValue: SecretValueOrigin.of(each).awaitsValue,
        entersSandbox: allowsSandboxes(each.sandbox),
      };
    });
  }
}
