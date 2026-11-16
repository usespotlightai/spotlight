import { SecretResourceMapper } from '@secrets/application/mappers/secret-resource.mapper';
import type {
  SecretConfigurationPort,
  SecretView,
} from '@secrets/application/ports/secret-configuration.port';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { isReservedSecretName } from '@secrets/domain/value-objects/reserved-secret-name';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretConfiguration implements SecretConfigurationPort {
  constructor(private readonly secrets: SecretRepository) {}

  async in(workspaceId: WorkspaceId): Promise<readonly SecretView[]> {
    return (await this.secrets.inWorkspace(workspaceId))
      .filter((each) => !isReservedSecretName(each.name.value))
      .map((each) => SecretResourceMapper.configured(each));
  }

  async withId(id: string): Promise<SecretView | null> {
    const secret = await this.secrets.withId(SecretId.of(id));

    return secret && !isReservedSecretName(secret.name.value)
      ? SecretResourceMapper.configured(secret)
      : null;
  }
}
