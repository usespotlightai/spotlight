import type {
  AgentProblem,
  CancelledRun,
  LeasedSearchRun,
  LiveConfig,
  OracleAnswerInput,
  PickableRun,
  ReplayRunOrder,
  ReplayRunQueued,
  RunReplayability,
  RunSummary,
  SearchRunOrder,
  SearchRunQueued,
  SearchRunStatus,
  StationView,
  UnclaimedCancellation,
  ValidatedCandidate,
  WorkPort,
} from '@replays/application/ports/work.port';
import type { OracleAnswer } from '@replays/domain/services/oracle-answer';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ReplayCandidatesPort,
  ReplayStation,
  CandidateScoring as ScoredBy,
} from '@work/application/ports/replay-candidates.port';
import type {
  ReplayAnswer,
  ReplayDispatchPort,
} from '@work/application/ports/replay-dispatch.port';
import type {
  Replayability,
  ReplayableRunsPort,
} from '@work/application/ports/replayable-runs.port';
import type { SearchDispatchPort } from '@work/application/ports/search-dispatch.port';
import type { SearchRunsPort } from '@work/application/ports/search-runs.port';
import type { StartingPointHoldsPort } from '@work/application/ports/starting-point-holds.port';

const stationOf = (station: ReplayStation): StationView => ({
  workspaceId: WorkspaceId.of(station.workspaceId),
  teamId: TeamId.of(station.teamId),
  lineId: station.lineId,
  lineKey: station.lineKey,
  stationId: station.stationId,
  key: station.key,
  name: station.name,
  source: station.source
    ? {
        repository: Repository.of(station.source.repository),
        path: station.source.path,
      }
    : null,
});

const replayabilityOf = (each: Replayability): RunReplayability => ({
  runId: RunId.of(each.runId),
  taskId: each.taskId ? TaskId.of(each.taskId) : null,
  stationId: each.stationId,
  unreplayableReason: each.unreplayableReason,
  reason: each.reason,
});

const scoringOf = (scoring: ScoredBy): CandidateScoring =>
  CandidateScoring.of({
    checksChanges: scoring.checksChanges,
    judge: scoring.judge && JudgeCriteria.of(scoring.judge),
    rubricVersion: scoring.rubricVersion,
  });

const ANSWERS: Record<OracleAnswer, ReplayAnswer> = {
  accepted: 'accepted',
  'sent-back': 'sent-back',
};

export class Work implements WorkPort {
  constructor(
    private readonly runs: ReplayableRunsPort,
    private readonly candidates: ReplayCandidatesPort,
    private readonly dispatching: ReplayDispatchPort,
    private readonly startingPointHolds: StartingPointHoldsPort,
    private readonly searching: SearchDispatchPort,
    private readonly searchRuns: SearchRunsPort,
  ) {}

  async station(
    lineId: string,
    stationId: string,
  ): Promise<StationView | null> {
    const station = await this.candidates.station(lineId, stationId);

    return station ? stationOf(station) : null;
  }

  async keyed(lineId: string, key: string): Promise<StationView | null> {
    const station = await this.candidates.keyed(lineId, key);

    return station ? stationOf(station) : null;
  }

  async replayable(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly RunReplayability[]> {
    if (runs.length === 0) {
      return [];
    }

    return (
      await this.runs.check(
        workspaceId.value,
        runs.map((each) => each.value),
      )
    ).map(replayabilityOf);
  }

  async runSummaries(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly RunSummary[]> {
    if (runs.length === 0) {
      return [];
    }

    return (
      await this.runs.summaries(
        workspaceId.value,
        runs.map((each) => each.value),
      )
    ).map((each) => ({
      ...replayabilityOf(each),
      title: each.title,
      state: each.state,
      endedAt: each.endedAt,
      origin: each.origin,
    }));
  }

  async recentAt(
    workspaceId: WorkspaceId,
    stationId: string,
    max: number,
  ): Promise<readonly PickableRun[]> {
    return (await this.runs.recentAt(workspaceId.value, stationId, max)).map(
      (each) => ({
        ...replayabilityOf(each),
        title: each.title,
        state: each.state,
        endedAt: each.endedAt,
        origin: each.origin,
      }),
    );
  }

  async validate(
    lineId: string,
    stationId: string,
    block: unknown,
    line: PlannedLine | null = null,
  ): Promise<ValidatedCandidate | null> {
    const validated = await this.candidates.validate(
      lineId,
      stationId,
      block,
      line ? line.repositories : undefined,
    );

    if (!validated) {
      return null;
    }

    return validated.ok
      ? {
          ok: true,
          fingerprint: StationFingerprint.of(validated.fingerprint),
          hashes: StationHashes.of(validated.hashes),
          liveHashes: StationHashes.of(validated.liveHashes),
          scoring: scoringOf(validated.scoring),
          changedFrom: StationChanges.of(
            StationFingerprint.of(validated.live),
            validated.changes,
          ),
          block: StationBlock.of(validated.station),
        }
      : validated;
  }

  async live(lineId: string, stationId: string): Promise<LiveConfig | null> {
    const live = await this.candidates.live(lineId, stationId);

    return live
      ? {
          lineKey: live.lineKey,
          block: StationBlock.of(live.station),
          fingerprint: StationFingerprint.of(live.fingerprint),
          scoring: scoringOf(live.scoring),
          hashes: StationHashes.of(live.hashes),
          threshold: live.replayCheck && ReplayThreshold.of(live.replayCheck),
        }
      : null;
  }

  async answerable(
    inputs: readonly OracleAnswerInput[],
  ): Promise<readonly RunId[]> {
    const answered = await this.dispatching.answerable(
      inputs.map((each) => ({
        original: each.run.value,
        answer: ANSWERS[each.answer],
      })),
    );

    return answered.map((each) => RunId.of(each));
  }

  async dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued> {
    const dispatched = await this.dispatching.enqueue({
      id: order.run.value,
      original: order.original.value,
      workspaceId: order.workspaceId.value,
      lineId: order.lineId,
      stationId: order.stationId,
      station: order.block.value,
      ...(order.line ? { repositories: order.line.repositories } : {}),
      answer: order.answer && ANSWERS[order.answer],
    });

    return dispatched.outcome === 'queued'
      ? {
          queued: true,
          fingerprint: dispatched.fingerprint
            ? StationFingerprint.of(dispatched.fingerprint)
            : null,
        }
      : {
          queued: false,
          unreplayableReason: dispatched.unreplayableReason,
        };
  }

  cancelQueued(runs: readonly RunId[]): Promise<void> {
    return this.dispatching.cancelQueued(runs.map((each) => each.value));
  }

  async cancel(run: RunId, leaveRunAsIs: boolean): Promise<CancelledRun> {
    const cancelled = await this.dispatching.cancel(run.value, leaveRunAsIs);

    return cancelled.outcome === 'queued'
      ? {
          queued: true,
          fingerprint: cancelled.fingerprint
            ? StationFingerprint.of(cancelled.fingerprint)
            : null,
        }
      : { queued: false };
  }

  durations(runs: readonly RunId[]): Promise<ReadonlyMap<string, number>> {
    return this.runs.durations(runs.map((each) => each.value));
  }

  agentProblem(agent: SearchAgent): AgentProblem | null {
    return this.searching.problemOf({
      harness: agent.harness,
      model: agent.model,
      effort: agent.effort,
    });
  }

  async dispatchSearch(order: SearchRunOrder): Promise<SearchRunQueued> {
    const dispatched = await this.searching.enqueue({
      id: order.run.value,
      searchId: order.searchId.value,
      iteration: order.iteration,
      lineId: order.lineId,
      stationId: order.stationId,
      agent: {
        harness: order.agent.harness,
        model: order.agent.model,
        effort: order.agent.effort,
      },
      briefing: order.briefing,
    });

    return dispatched.outcome === 'queued'
      ? { queued: true }
      : { queued: false, reason: dispatched.reason };
  }

  cancelSearchRun(run: RunId): Promise<void> {
    return this.searching.cancel(run.value);
  }

  cancelUnclaimedSearchRun(run: RunId): Promise<UnclaimedCancellation> {
    return this.searching.cancelUnclaimed(run.value);
  }

  async leasedSearchRun(
    run: RunId,
    runnerId: string,
  ): Promise<LeasedSearchRun | null> {
    const leased = await this.searchRuns.leasedSearchRun(run.value, runnerId);

    return leased
      ? { searchId: SearchId.of(leased.searchId), iteration: leased.iteration }
      : null;
  }

  async searchRunStatuses(
    runs: readonly RunId[],
  ): Promise<readonly SearchRunStatus[]> {
    if (runs.length === 0) {
      return [];
    }

    return (await this.searchRuns.statuses(runs.map((each) => each.value))).map(
      ({ runId, ...status }) => ({ ...status, run: RunId.of(runId) }),
    );
  }

  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void> {
    return this.startingPointHolds.hold(
      holder,
      workspaceId.value,
      runs.map((each) => each.value),
    );
  }

  release(holder: string): Promise<void> {
    return this.startingPointHolds.release(holder);
  }
}
