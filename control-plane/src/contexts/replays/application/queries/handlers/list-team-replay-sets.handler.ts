import type { ReplaySetDto } from '@replays/application/dto/replays.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ListTeamReplaySetsQuery } from '@replays/application/queries/list-team-replay-sets.query';
import { setView } from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListTeamReplaySetsHandler
  implements QueryHandlerPort<ListTeamReplaySetsQuery, readonly ReplaySetDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly work: WorkPort,
  ) {}

  async execute(
    query: ListTeamReplaySetsQuery,
  ): Promise<readonly ReplaySetDto[]> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const at = query.at
        ? await this.access.keyedStationOn(
            clearance,
            query.at.lineId,
            query.at.key,
          )
        : null;
      const sets = (await this.sets.ofTeam(clearance.teamId)).filter(
        (each) =>
          clearance.sees(each.station) &&
          (!at || each.station.stationId === at.stationId),
      );
      const standing = await this.work.standing(
        clearance.workspaceId,
        sets.flatMap((each) => each.runs),
      );

      return sets.map((each) => setView(each, standing));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
