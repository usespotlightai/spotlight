import type { ReplaySetDto } from '@replays/application/dto/replays.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ListReplaySetsQuery } from '@replays/application/queries/list-replay-sets.query';
import { setView } from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetNoises } from '@replays/application/services/set-noises.service';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-reading';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListReplaySetsHandler
  implements QueryHandlerPort<ListReplaySetsQuery, readonly ReplaySetDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly work: WorkPort,
    private readonly noises: SetNoises,
  ) {}

  async execute(query: ListReplaySetsQuery): Promise<readonly ReplaySetDto[]> {
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
      const sets = (await this.sets.atStation(station.stationId)).filter(
        (each) => clearance.sees(each.station),
      );
      const replayable = await this.work.standing(
        clearance.workspaceId,
        sets.flatMap((each) => each.runs),
      );

      const standards = await this.noises.standardsAt(
        sets.map((each) => each.station),
      );
      const noises = await this.noises.ofSets(sets, standards);

      return sets.map((each) =>
        setView(
          each,
          replayable,
          noises.get(each.id.value) ?? null,
          standards.get(each.station.stationId)?.minGain ?? DEFAULT_MIN_GAIN,
        ),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
