import type { SecretsAwaitingValuePort } from '@configuration/application/ports/secrets-awaiting-value.port';
import type { SecretReadinessPort } from '@secrets/application/ports/secret-readiness.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceSecretsAwaitingValue implements SecretsAwaitingValuePort {
  constructor(private readonly readiness: SecretReadinessPort) {}

  async awaitingValueIn(
    workspaceId: WorkspaceId,
    names: readonly SecretName[],
  ): Promise<readonly SecretName[]> {
    return (
      await this.readiness.awaitingValue(
        workspaceId.value,
        names.map((each) => each.value),
      )
    ).map((each) => SecretName.of(each));
  }
}
