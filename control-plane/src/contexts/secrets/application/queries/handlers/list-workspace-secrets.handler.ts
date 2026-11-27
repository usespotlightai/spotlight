import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceSecretDto } from '@secrets/application/dto/workspace-secret.dto';
import { WorkspaceSecretMapper } from '@secrets/application/mappers/workspace-secret.mapper';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import type { ListWorkspaceSecretsQuery } from '@secrets/application/queries/list-workspace-secrets.query';
import type { SecretReaches } from '@secrets/application/services/secret-reaches.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListWorkspaceSecretsHandler implements QueryHandlerPort<
  ListWorkspaceSecretsQuery,
  readonly WorkspaceSecretDto[] | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: SecretResourcesPort,
    private readonly reaches: SecretReaches,
  ) {}

  async execute(
    query: ListWorkspaceSecretsQuery,
  ): Promise<readonly WorkspaceSecretDto[] | null> {
    try {
      const permissions = await this.access.permissionsInSlug(
        query.slug,
        query.principal,
      );

      if (!permissions) {
        return null;
      }

      const manages = permissions.scopes.has('secrets');
      const reached = await this.reaches.ofEach(
        await this.resources.secretsIn(permissions.workspaceId),
      );

      return reached.map(({ record, reach }) =>
        WorkspaceSecretMapper.toDto(record, manages, reach),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
