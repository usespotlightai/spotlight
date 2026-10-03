import type { ReplayDto } from '@replays/application/dto/replays.dto';
import type { ListReplaysQuery } from '@replays/application/queries/list-replays.query';
import { replayView } from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetNoises } from '@replays/application/services/set-noises.service';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { baselineOf } from '@replays/domain/services/baseline';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListReplaysHandler
  implements QueryHandlerPort<ListReplaysQuery, readonly ReplayDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly noises: SetNoises,
  ) {}

  async execute(query: ListReplaysQuery): Promise<readonly ReplayDto[]> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const set = await this.access.setOn(clearance, query.setId);
      const replays = await this.replays.ofSet(set.id);
      const candidates = await this.candidates.findMany(
        replays.map((each) => each.candidateId),
      );
      const baseline = baselineOf(replays);
      const { minGain } = await this.noises.standardAt(set.station);

      return [...replays]
        .sort(
          (one, other) => other.startedAt.getTime() - one.startedAt.getTime(),
        )
        .map((each) =>
          replayView(
            each,
            candidates.find((candidate) =>
              candidate.id.equals(each.candidateId),
            ) ?? null,
            baseline,
            minGain,
          ),
        );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
