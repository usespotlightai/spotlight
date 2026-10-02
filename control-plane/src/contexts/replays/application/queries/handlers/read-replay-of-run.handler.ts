import type { ReplayOfRunDto } from '@replays/application/dto/replays.dto';
import type { ReadReplayOfRunQuery } from '@replays/application/queries/read-replay-of-run.query';
import {
  candidateView,
  entryView,
  replaySearchView,
} from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { baselineOf } from '@replays/domain/services/baseline';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ReadReplayOfRunHandler
  implements QueryHandlerPort<ReadReplayOfRunQuery, ReplayOfRunDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly replays: ReplayRepository,
    private readonly sets: ReplaySetRepository,
    private readonly candidates: CandidateRepository,
  ) {}

  async execute(query: ReadReplayOfRunQuery): Promise<ReplayOfRunDto> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const run = RunId.of(query.runId);
      const replay = await this.access.replayRanAs(clearance, run);
      const entry = replay.entries.find((each) => each.ranAs(run));
      const [set, candidate, ofSet] = await Promise.all([
        this.sets.find(replay.setId),
        this.candidates.find(replay.candidateId),
        this.replays.ofSet(replay.setId),
      ]);

      return {
        replayId: replay.id.value,
        setId: replay.setId.value,
        setName: set?.name.value ?? null,
        lineId: replay.station.lineId,
        stationId: replay.station.stationId,
        candidate: candidate ? candidateView(candidate) : null,
        startedAsBaseline: replay.baseline,
        isBaseline: baselineOf(ofSet)?.id.equals(replay.id) ?? false,
        state: replay.current,
        search: replaySearchView(replay, candidate),
        entry: entry ? entryView(entry, replay.scoring) : null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
