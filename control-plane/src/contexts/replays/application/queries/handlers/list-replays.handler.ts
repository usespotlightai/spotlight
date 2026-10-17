import type { ReplayDto } from '@replays/application/dto/replays.dto';
import type { ListReplaysQuery } from '@replays/application/queries/list-replays.query';
import { replayView } from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { baselineOf, comparedAgainst } from '@replays/domain/services/baseline';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListReplaysHandler
  implements QueryHandlerPort<ListReplaysQuery, readonly ReplayDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly healths: SetHealths,
  ) {}

  async execute(query: ListReplaysQuery): Promise<readonly ReplayDto[]> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const set = await this.access.setOn(access, query.setId);
      const replays = await this.replays.ofSet(set.id);
      const candidates = await this.candidates.findMany(
        replays.map((each) => each.candidateId),
      );
      const baseline = baselineOf(replays);
      const { minGain } = await this.healths.standardAt(set.station);

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
            comparedAgainst(each, replays),
            minGain,
          ),
        );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
