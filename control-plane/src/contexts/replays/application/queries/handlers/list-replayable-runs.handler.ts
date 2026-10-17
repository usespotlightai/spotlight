import type { ReplayableRunDto } from '@replays/application/dto/replays.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ListReplayableRunsQuery } from '@replays/application/queries/list-replayable-runs.query';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const MAX_PICKED_FROM = 50;

export class ListReplayableRunsHandler
  implements
    QueryHandlerPort<ListReplayableRunsQuery, readonly ReplayableRunDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly work: WorkPort,
  ) {}

  async execute(
    query: ListReplayableRunsQuery,
  ): Promise<readonly ReplayableRunDto[]> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const station = await this.access.stationOn(
        access,
        query.lineId,
        query.stationId,
      );

      return (
        await this.work.recentAt(
          access.workspaceId,
          station.stationId,
          MAX_PICKED_FROM,
        )
      ).map((each) => ({
        runId: each.runId.value,
        taskId: each.taskId?.value ?? null,
        title: each.title,
        state: each.state,
        endedAt: each.endedAt.toISOString(),
        unreplayableReason: each.unreplayableReason,
        reason: each.reason,
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
