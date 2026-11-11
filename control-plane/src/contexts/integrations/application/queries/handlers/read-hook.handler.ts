import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { HookResourceDto } from '@integrations/application/dto/hook-resource.dto';
import type { HookResourcesPort } from '@integrations/application/ports/hook-resources.port';
import type { ReadHookQuery } from '@integrations/application/queries/read-hook.query';
import type { HookViews } from '@integrations/application/services/hook-views.service';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadHookHandler
  implements QueryHandlerPort<ReadHookQuery, HookResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: HookResourcesPort,
    private readonly views: HookViews,
  ) {}

  async execute(query: ReadHookQuery): Promise<HookResourceDto | null> {
    try {
      const record = await this.resources.withId(
        HookDefinitionId.of(query.hookId),
      );

      if (
        !record ||
        !(await this.access.permissionsInWorkspaceOfTeam(
          record.teamId,
          query.principal,
        ))
      ) {
        return null;
      }

      return this.views.of(record);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
