import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceSecretDto } from '@secrets/application/dto/workspace-secret.dto';
import { WorkspaceSecretMapper } from '@secrets/application/mappers/workspace-secret.mapper';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import type { ListWorkspaceSecretsQuery } from '@secrets/application/queries/list-workspace-secrets.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListWorkspaceSecretsHandler implements QueryHandlerPort<
  ListWorkspaceSecretsQuery,
  readonly WorkspaceSecretDto[] | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: SecretResourcesPort,
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

      return (await this.resources.secretsIn(permissions.workspaceId)).map(
        (each) => WorkspaceSecretMapper.toDto(each, manages),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
