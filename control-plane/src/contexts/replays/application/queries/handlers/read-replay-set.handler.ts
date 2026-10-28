import type { ReplaySetDto } from '@replays/application/dto/replays.dto';
import type { InsightsPort } from '@replays/application/ports/insights.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReadReplaySetQuery } from '@replays/application/queries/read-replay-set.query';
import {
  runsToSummarize,
  setView,
} from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import { StationWithoutReplaySetError } from '@replays/domain/exceptions/station-without-replay-set.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadReplaySetHandler
  implements QueryHandlerPort<ReadReplaySetQuery, ReplaySetDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly work: WorkPort,
    private readonly insights: InsightsPort,
    private readonly healths: SetHealths,
    private readonly schedules: StationSearchScheduleRepository,
  ) {}

  async execute(query: ReadReplaySetQuery): Promise<ReplaySetDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const station = await this.access.stationOn(
        access,
        query.lineId,
        query.stationId,
      );
      const set = await this.sets.ofStation(station.stationId);

      if (!set || !access.sees(set.station)) {
        throw new StationWithoutReplaySetError(station.stationId);
      }

      const summaries = await this.work.runSummaries(
        access.workspaceId,
        runsToSummarize(set),
      );
      const originalOutcomes = await this.insights.originalOutcomes(set.runs);
      const standard = await this.healths.standardAt(set.station);

      return setView(
        set,
        summaries,
        originalOutcomes,
        await this.healths.ofSet(set, standard),
        standard.minGain,
        await this.schedules.ofSet(set.id),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
