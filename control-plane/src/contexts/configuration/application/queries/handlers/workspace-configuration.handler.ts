import type { ExportableConfigurationDto } from '@configuration/application/dto/exportable-configuration.dto';
import type { WorkspaceConfigurationQuery } from '@configuration/application/queries/workspace-configuration.query';
import type { ExportableConfigurations } from '@configuration/application/services/exportable-configurations.service';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceConfigurationHandler
  implements
    QueryHandlerPort<
      WorkspaceConfigurationQuery,
      ExportableConfigurationDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly configurations: ExportableConfigurations,
  ) {}

  async execute(
    query: WorkspaceConfigurationQuery,
  ): Promise<ExportableConfigurationDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const workspace =
        permissions &&
        (await this.workspaces.profileOf(permissions.workspaceId.value));

      return workspace ? await this.configurations.of(workspace) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
