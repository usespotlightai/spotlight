import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import { SecretResourceMapper } from '@secrets/application/mappers/secret-resource.mapper';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import type { ReadSecretQuery } from '@secrets/application/queries/read-secret.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadSecretHandler
  implements QueryHandlerPort<ReadSecretQuery, SecretResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: SecretResourcesPort,
  ) {}

  async execute(query: ReadSecretQuery): Promise<SecretResourceDto | null> {
    try {
      const record = await this.resources.withId(query.secretId);

      return record &&
        (await this.access.permissionsIn(record.workspaceId, query.principal))
        ? SecretResourceMapper.toDto(record)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
