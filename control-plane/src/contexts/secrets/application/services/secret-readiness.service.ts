import type { SecretReadinessPort } from '@secrets/application/ports/secret-readiness.port';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import { SecretValueOrigin } from '@secrets/domain/value-objects/secret-value-origin.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretReadiness implements SecretReadinessPort {
  constructor(private readonly secrets: SecretResourcesPort) {}

  async awaitingValue(
    workspaceId: string,
    names: readonly string[],
  ): Promise<readonly string[]> {
    const found = await this.secrets.namedIn(
      WorkspaceId.of(workspaceId),
      names,
    );

    return found
      .filter((each) => SecretValueOrigin.of(each).awaitsValue)
      .map((each) => each.name);
  }
}
