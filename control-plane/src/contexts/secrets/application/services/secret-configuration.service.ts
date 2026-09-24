import { SecretResourceMapper } from '@secrets/application/mappers/secret-resource.mapper';
import type {
  ConfiguredSecret,
  SecretConfigurationPort,
} from '@secrets/application/ports/secret-configuration.port';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretConfiguration implements SecretConfigurationPort {
  constructor(private readonly secrets: SecretRepository) {}

  async in(workspaceId: WorkspaceId): Promise<readonly ConfiguredSecret[]> {
    return (await this.secrets.inWorkspace(workspaceId)).map(
      SecretResourceMapper.configured,
    );
  }

  async withId(id: string): Promise<ConfiguredSecret | null> {
    const secret = await this.secrets.withId(SecretId.of(id));

    return secret ? SecretResourceMapper.configured(secret) : null;
  }
}
