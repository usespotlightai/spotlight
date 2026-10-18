import type { ReplayDetailDto } from '@replays/application/dto/replays.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReadReplayQuery } from '@replays/application/queries/read-replay.query';
import {
  entryView,
  replaySearchView,
  replayView,
} from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { baselineOf, comparedAgainst } from '@replays/domain/services/baseline';
import { taskComparisons } from '@replays/domain/services/replay-results';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadReplayHandler
  implements QueryHandlerPort<ReadReplayQuery, ReplayDetailDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly work: WorkPort,
    private readonly healths: SetHealths,
  ) {}

  async execute(query: ReadReplayQuery): Promise<ReplayDetailDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const replay = await this.access.replayOn(access, query.replayId);
      const setReplays = await this.replays.ofSet(replay.setId);
      const baseline = baselineOf(setReplays);
      const against = comparedAgainst(replay, setReplays);
      const candidate = await this.candidates.find(replay.candidateId);
      const compared = taskComparisons(replay, against);
      const { minGain } = await this.healths.standardAt(replay.station);
      const titles = new Map(
        (
          await this.work.runSummaries(access.workspaceId, replay.originals)
        ).map((each) => [each.runId.value, each.title]),
      );

      return {
        ...replayView(replay, candidate, baseline, against, minGain),
        baselineReplayId: baseline?.id.value ?? null,
        search: replaySearchView(replay, candidate),
        comparison: compared.map((each) => ({
          originalRunId: each.original,
          taskId: each.taskId,
          title: titles.get(each.original) ?? null,
          candidate: each.candidate.map((repeat) =>
            entryView(repeat, replay.scoring),
          ),
          baseline: against
            ? each.baseline.map((repeat) => entryView(repeat, against.scoring))
            : [],
          candidateSuccess: each.candidateSuccess,
          baselineSuccess: each.baselineSuccess,
          costDelta: each.costDelta,
          msDelta: each.msDelta,
          stepsDelta: each.stepsDelta,
          scoreDelta: each.scoreDelta,
          scoreUncompared: each.scoreUncompared,
          regressed: each.regressed,
          pair: each.pair,
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
