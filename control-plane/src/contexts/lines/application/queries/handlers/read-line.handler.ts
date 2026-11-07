import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { LineResourceDto } from '@lines/application/dto/line-resource.dto';
import type { LineResourcesPort } from '@lines/application/ports/line-resources.port';
import type { ReadLineQuery } from '@lines/application/queries/read-line.query';
import type { LineViews } from '@lines/application/services/line-views.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadLineHandler
  implements QueryHandlerPort<ReadLineQuery, LineResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: LineResourcesPort,
    private readonly views: LineViews,
  ) {}

  async execute(query: ReadLineQuery): Promise<LineResourceDto | null> {
    try {
      const record = await this.resources.withId(query.lineId);

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
