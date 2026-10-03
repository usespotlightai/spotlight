import type {
  CheckSideDto,
  ReplayCheckDto,
} from '@replays/application/dto/replay-checks.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReadReplayCheckQuery } from '@replays/application/queries/read-replay-check.query';
import type { CheckReadings } from '@replays/application/services/check-readings.service';
import { replayUrlOf } from '@replays/application/services/replay-check-views';
import {
  entryView,
  gainView,
  intervalView,
  spendView,
} from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { UnknownReplayCheckError } from '@replays/domain/exceptions/unknown-replay-check.error';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplayTotals } from '@replays/domain/services/replay-results';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
  spent: totals ? spendView(totals.spent) : null,
});

const reasonsOf = (copies: readonly ReplayEntry[]) => [
  ...new Map(
    copies
      .flatMap((copy) => copy.reasons)
      .map((reason) => [
        `${reason.code}:${reason.detail}`,
        { code: reason.code, detail: reason.detail },
      ]),
  ).values(),
];

export class ReadReplayCheckHandler
  implements QueryHandlerPort<ReadReplayCheckQuery, ReplayCheckDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly checks: ReplayCheckRepository,
    private readonly readings: CheckReadings,
    private readonly webOrigin: string,
  ) {}

  async execute(query: ReadReplayCheckQuery): Promise<ReplayCheckDto> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const check = await this.checks.find(ReplayCheckId.of(query.checkId));

      if (!check || !clearance.sees(check.station)) {
        throw new UnknownReplayCheckError(query.checkId);
      }

      const [{ reading, replay, baseline, set }, slug] = await Promise.all([
        this.readings.of(check),
        this.people.workspaceSlug(check.workspaceId),
      ]);
      const titles = new Map(
        (
          await this.work.standing(
            check.workspaceId,
            reading.regressions.flatMap((each) =>
              each.candidate.map((copy) => copy.original),
            ),
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
        setName: set?.name.value ?? null,
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
        keptLive: [...check.keptLive],
        threshold: {
          mostRegressions: check.threshold.mostRegressions,
          minGain: check.threshold.minGain,
          ceiling: spendView(check.threshold.ceiling),
          unpricedRun: replay
            ? spendView(check.threshold.unpricedRunIn(replay.entries.length))
            : null,
        },
        repeats: check.repeats,
        gain: gainView(reading.gain),
        verdict: reading.verdict,
        undecidedBecause: reading.because,
        tasks: reading.entries,
        compared: reading.compared,
        candidate: sideOf(replay, reading.candidate),
        baseline: sideOf(baseline, reading.baseline),
        regressions: reading.regressions.map((each) => ({
          taskId: each.taskId,
          originalRunId: each.original,
          title: titles.get(each.original) ?? null,
          candidate: each.candidate.map(
            (copy) => entryView(copy, (replay as Replay).scoring).result,
          ),
          baseline: baseline
            ? each.baseline.map(
                (copy) => entryView(copy, baseline.scoring).result,
              )
            : [],
          scoreDelta: each.scoreDelta,
          reasons: reasonsOf(each.candidate),
        })),
        replayUrl: replayUrlOf(this.webOrigin, slug, check),
        createdAt: check.createdAt.toISOString(),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
