import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import { SecretResourceMapper } from '@secrets/application/mappers/secret-resource.mapper';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import type { ListSecretResourcesQuery } from '@secrets/application/queries/list-secret-resources.query';
import type { SecretRunReach } from '@secrets/application/services/secret-run-reach.service';
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
    private readonly reach: SecretRunReach,
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

      const records = await this.resources.secretsIn(permissions.workspaceId);
      const unreached = await this.reach.unreached(records);

      return records.map((each) =>
        SecretResourceMapper.toDto(each, !unreached.has(each.name)),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
