import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import { SecretResourceMapper } from '@secrets/application/mappers/secret-resource.mapper';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import type { ListSecretResourcesQuery } from '@secrets/application/queries/list-secret-resources.query';
import type { SecretReaches } from '@secrets/application/services/secret-reaches.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListSecretResourcesHandler implements QueryHandlerPort<
  ListSecretResourcesQuery,
  readonly SecretResourceDto[] | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: SecretResourcesPort,
    private readonly reaches: SecretReaches,
  ) {}

  async execute(
    query: ListSecretResourcesQuery,
  ): Promise<readonly SecretResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!permissions) {
        return null;
      }

      const reached = await this.reaches.ofEach(
        await this.resources.secretsIn(permissions.workspaceId),
      );

      return reached.map(({ record, reach }) =>
        SecretResourceMapper.toDto(record, reach),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
