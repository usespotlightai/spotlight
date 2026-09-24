import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import { SecretResourceMapper } from '@secrets/application/mappers/secret-resource.mapper';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import type { ListSecretResourcesQuery } from '@secrets/application/queries/list-secret-resources.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListSecretResourcesHandler
  implements
    QueryHandlerPort<
      ListSecretResourcesQuery,
      readonly SecretResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: SecretResourcesPort,
  ) {}

  async execute(
    query: ListSecretResourcesQuery,
  ): Promise<readonly SecretResourceDto[] | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return cleared
        ? (await this.resources.secretsIn(cleared.workspaceId)).map(
            SecretResourceMapper.toDto,
          )
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
