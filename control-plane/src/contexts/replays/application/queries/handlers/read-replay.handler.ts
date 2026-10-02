import type { ReplayDetailDto } from '@replays/application/dto/replays.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReadReplayQuery } from '@replays/application/queries/read-replay.query';
import {
  entryView,
  replaySearchView,
  replayView,
} from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { baselineOf } from '@replays/domain/services/baseline';
import { comparedWith } from '@replays/domain/services/replay-results';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadReplayHandler
  implements QueryHandlerPort<ReadReplayQuery, ReplayDetailDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadReplayQuery): Promise<ReplayDetailDto> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const replay = await this.access.replayOn(clearance, query.replayId);
      const baseline = baselineOf(await this.replays.ofSet(replay.setId));
      const against = baseline?.id.equals(replay.id) ? null : baseline;
      const candidate = await this.candidates.find(replay.candidateId);
      const compared = comparedWith(replay, against);
      const titles = new Map(
        (
          await this.work.standing(
            clearance.workspaceId,
            replay.entries.map((each) => each.original),
          )
        ).map((each) => [each.runId.value, each.title]),
      );

      return {
        ...replayView(replay, candidate, baseline),
        baselineReplayId: baseline?.id.value ?? null,
        search: replaySearchView(replay, candidate),
        comparison: compared.map((each) => ({
          originalRunId: each.original,
          taskId: each.taskId,
          title: titles.get(each.original) ?? null,
          candidate: entryView(each.candidate, replay.scoring),
          baseline:
            each.baseline && against
              ? entryView(each.baseline, against.scoring)
              : null,
          costDelta: each.costDelta,
          msDelta: each.msDelta,
          stepsDelta: each.stepsDelta,
          scoreDelta: each.scoreDelta,
          scoreUncompared: each.scoreUncompared,
          regressed: each.regressed,
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
