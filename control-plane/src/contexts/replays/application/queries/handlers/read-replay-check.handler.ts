import type {
  CheckSideDto,
  ReplayCheckDto,
} from '@replays/application/dto/replay-checks.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReadReplayCheckQuery } from '@replays/application/queries/read-replay-check.query';
import { taskRowsOf } from '@replays/application/rendering/task-rows';
import type { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import {
  gainView,
  intervalView,
  moneyView,
} from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { UnknownReplayCheckError } from '@replays/domain/exceptions/unknown-replay-check.error';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplayTotals } from '@replays/domain/services/replay-results';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const sideOf = (
  replay: Replay | null,
  totals: ReplayTotals | null,
): CheckSideDto => ({
  state: replay?.current ?? null,
  entries: totals?.entries ?? 0,
  scored: totals?.scored ?? 0,
  succeeded: totals?.succeeded ?? null,
  successRate: totals?.successRate ?? null,
  interval: intervalView(totals?.interval ?? null),
  tasksScored: totals?.tasksScored ?? 0,
  spent: totals ? moneyView(totals.spent) : null,
});

export class ReadReplayCheckHandler
  implements QueryHandlerPort<ReadReplayCheckQuery, ReplayCheckDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly work: WorkPort,
    private readonly checks: ReplayCheckRepository,
    private readonly evaluations: CheckEvaluations,
  ) {}

  async execute(query: ReadReplayCheckQuery): Promise<ReplayCheckDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const check = await this.checks.find(ReplayCheckId.of(query.checkId));

      if (!check || !access.sees(check.station)) {
        throw new UnknownReplayCheckError(query.checkId);
      }

      const { evaluation, replay, baseline } = await this.evaluations.of(check);
      const titles = new Map(
        (
          await this.work.runSummaries(
            check.workspaceId,
            replay?.originals ?? [],
          )
        ).map((each) => [each.runId.value, each.title]),
      );

      return {
        id: check.id.value,
        teamId: check.teamId.value,
        lineId: check.station.lineId,
        stationId: check.station.stationId,
        stationKey: check.stationKey,
        setId: check.setId.value,
        candidateId: check.candidateId.value,
        replayId: check.replayId.value,
        baselineReplayId: baseline?.id.value ?? null,
        attempt: check.attempt,
        reference: {
          commit: check.reference.commit,
          pullRequest: check.reference.pullRequest,
        },
        liveFingerprint: check.liveFingerprint.value,
        candidateFingerprint: check.candidateFingerprint.value,
        scoringPinnedToLive: [...check.scoringPinnedToLive],
        threshold: {
          maxRegressions: check.threshold.maxRegressions,
          minGain: check.threshold.minGain,
          ceiling: moneyView(check.threshold.ceiling),
          unpricedRun: replay
            ? moneyView(check.threshold.unpricedRunIn(replay.entries.length))
            : null,
        },
        repeats: check.repeats,
        gain: gainView(evaluation.gain),
        result: evaluation.result,
        undecidedBecause: evaluation.because,
        taskCount: evaluation.entries,
        compared: evaluation.compared,
        candidate: sideOf(replay, evaluation.candidate),
        baseline: sideOf(baseline, evaluation.baseline),
        tasks: replay
          ? taskRowsOf(
              evaluation.tasks,
              { candidate: replay.scoring, live: baseline?.scoring ?? null },
              titles,
            )
          : [],
        createdAt: check.createdAt.toISOString(),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
