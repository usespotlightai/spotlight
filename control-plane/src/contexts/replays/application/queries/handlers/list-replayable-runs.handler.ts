import type { ReplayableRunDto } from '@replays/application/dto/replays.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ListReplayableRunsQuery } from '@replays/application/queries/list-replayable-runs.query';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const MOST_PICKED_FROM = 50;

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
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const station = await this.access.stationOn(
        clearance,
        query.lineId,
        query.stationId,
      );

      return (
        await this.work.recentAt(
          clearance.workspaceId,
          station.stationId,
          MOST_PICKED_FROM,
        )
      ).map((each) => ({
        runId: each.runId.value,
        taskId: each.taskId?.value ?? null,
        title: each.title,
        state: each.state,
        endedAt: each.endedAt.toISOString(),
        refusal: each.refusal,
        reason: each.reason,
      }));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
