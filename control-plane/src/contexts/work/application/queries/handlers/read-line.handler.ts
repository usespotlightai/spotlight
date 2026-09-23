import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';
import type { ReadLineQuery } from '@work/application/queries/read-line.query';
import type { LineViews } from '@work/application/services/line-views.service';

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
      const kept = await this.resources.withId(query.lineId);

      if (
        !kept ||
        !(await this.access.onTeam(
          kept.teamId.value,
          UserId.of(query.viewerId),
        ))
      ) {
        return null;
      }

      return this.views.of(kept);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
