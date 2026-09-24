import type { HeldConfigurationDto } from '@configuration/application/dto/held-configuration.dto';
import type { WorkspaceConfigurationQuery } from '@configuration/application/queries/workspace-configuration.query';
import type { HeldConfigurations } from '@configuration/application/services/held-configurations.service';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceConfigurationHandler
  implements
    QueryHandlerPort<WorkspaceConfigurationQuery, HeldConfigurationDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly held: HeldConfigurations,
  ) {}

  async execute(
    query: WorkspaceConfigurationQuery,
  ): Promise<HeldConfigurationDto | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const workspace =
        cleared && (await this.workspaces.profileOf(cleared.workspaceId.value));

      return workspace ? await this.held.of(workspace) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
