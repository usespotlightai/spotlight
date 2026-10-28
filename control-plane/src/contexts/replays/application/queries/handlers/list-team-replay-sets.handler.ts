import type { ReplaySetDto } from '@replays/application/dto/replays.dto';
import type { InsightsPort } from '@replays/application/ports/insights.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ListTeamReplaySetsQuery } from '@replays/application/queries/list-team-replay-sets.query';
import {
  runsToSummarize,
  setView,
} from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-estimate';
import { UNREAD_HEALTH } from '@replays/domain/services/set-health';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListTeamReplaySetsHandler
  implements QueryHandlerPort<ListTeamReplaySetsQuery, readonly ReplaySetDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly work: WorkPort,
    private readonly insights: InsightsPort,
    private readonly healths: SetHealths,
  ) {}

  async execute(
    query: ListTeamReplaySetsQuery,
  ): Promise<readonly ReplaySetDto[]> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const at = query.at
        ? await this.access.keyedStationOn(
            access,
            query.at.lineId,
            query.at.key,
          )
        : null;
      const sets = (await this.sets.ofTeam(access.teamId)).filter(
        (each) =>
          access.sees(each.station) &&
          (!at || each.station.stationId === at.stationId),
      );
      const summaries = await this.work.runSummaries(
        access.workspaceId,
        sets.flatMap(runsToSummarize),
      );
      const originalOutcomes = await this.insights.originalOutcomes(
        sets.flatMap((each) => each.runs),
      );

      const standards = await this.healths.standardsAt(
        sets.map((each) => each.station),
      );
      const healths = await this.healths.ofSets(sets, standards);

      return sets.map((each) =>
        setView(
          each,
          summaries,
          originalOutcomes,
          healths.get(each.id.value) ?? UNREAD_HEALTH,
          standards.get(each.station.stationId)?.minGain ?? DEFAULT_MIN_GAIN,
        ),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
