import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunnerActivityDto } from '@work/application/dto/runner-activity.dto';
import type { RunnerActivityReaderPort } from '@work/application/ports/runner-activity-reader.port';
import type { ListRunnerActivityQuery } from '@work/application/queries/list-runner-activity.query';

export class ListRunnerActivityHandler
  implements
    QueryHandlerPort<ListRunnerActivityQuery, RunnerActivityDto[] | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly activity: RunnerActivityReaderPort,
  ) {}

  async execute(
    query: ListRunnerActivityQuery,
  ): Promise<RunnerActivityDto[] | null> {
    try {
      const membership = await this.access.inWorkspace(
        query.slug,
        UserId.of(query.viewerId),
      );

      if (!membership) {
        return null;
      }

      const held = await this.activity.heldIn(membership.workspaceId);

      return held.map((each) => ({
        runnerId: each.runnerId,
        currentRun: { id: each.runId, state: each.state },
      }));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
