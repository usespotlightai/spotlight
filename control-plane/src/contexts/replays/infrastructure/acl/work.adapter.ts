import type {
  ExaminedCandidate,
  LiveConfig,
  PickableRun,
  ReplayRunOrder,
  ReplayRunQueued,
  RunForgone,
  RunReplayability,
  StandingRun,
  StationAtHand,
  WorkPort,
} from '@replays/application/ports/work.port';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import {
  isReplayRefusal,
  type ReplayRefusal,
} from '@replays/domain/value-objects/replay-refusal';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ReplayCandidatesPort,
  ReplayStation,
} from '@work/application/ports/replay-candidates.port';
import type { ReplayDispatchPort } from '@work/application/ports/replay-dispatch.port';
import type {
  Replayability,
  ReplayableRunsPort,
} from '@work/application/ports/replayable-runs.port';
import type { StartingPointHoldsPort } from '@work/application/ports/starting-point-holds.port';

const refusalOf = (code: string | null): ReplayRefusal | null => {
  if (code === null) {
    return null;
  }

  return isReplayRefusal(code) ? code : 'cannot-start';
};

const stationOf = (station: ReplayStation): StationAtHand => ({
  workspaceId: WorkspaceId.of(station.workspaceId),
  teamId: TeamId.of(station.teamId),
  lineId: station.lineId,
  lineKey: station.lineKey,
  stationId: station.stationId,
  key: station.key,
  name: station.name,
});

const replayabilityOf = (each: Replayability): RunReplayability => ({
  runId: RunId.of(each.runId),
  taskId: each.taskId ? TaskId.of(each.taskId) : null,
  stationId: each.stationId,
  refusal: refusalOf(each.refusal),
  reason: each.reason,
});

export class Work implements WorkPort {
  constructor(
    private readonly runs: ReplayableRunsPort,
    private readonly candidates: ReplayCandidatesPort,
    private readonly dispatching: ReplayDispatchPort,
    private readonly holds: StartingPointHoldsPort,
  ) {}

  async station(
    lineId: string,
    stationId: string,
  ): Promise<StationAtHand | null> {
    const station = await this.candidates.station(lineId, stationId);

    return station ? stationOf(station) : null;
  }

  async keyed(lineId: string, key: string): Promise<StationAtHand | null> {
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

  async standing(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly StandingRun[]> {
    if (runs.length === 0) {
      return [];
    }

    return (
      await this.runs.standing(
        workspaceId.value,
        runs.map((each) => each.value),
      )
    ).map((each) => ({
      ...replayabilityOf(each),
      title: each.title,
      state: each.state,
      endedAt: each.endedAt,
    }));
  }

  async recentAt(
    workspaceId: WorkspaceId,
    stationId: string,
    most: number,
  ): Promise<readonly PickableRun[]> {
    return (await this.runs.recentAt(workspaceId.value, stationId, most)).map(
      (each) => ({
        ...replayabilityOf(each),
        title: each.title,
        state: each.state,
        endedAt: each.endedAt,
      }),
    );
  }

  async examine(
    lineId: string,
    stationId: string,
    block: unknown,
  ): Promise<ExaminedCandidate | null> {
    const examined = await this.candidates.examine(lineId, stationId, block);

    if (!examined) {
      return null;
    }

    return examined.ok
      ? {
          ok: true,
          fingerprint: StationFingerprint.of(examined.fingerprint),
          scoring: CandidateScoring.of(examined.scoring),
          changedFrom: StationChanges.of(
            StationFingerprint.of(examined.live),
            examined.changes,
          ),
        }
      : examined;
  }

  async live(lineId: string, stationId: string): Promise<LiveConfig | null> {
    const live = await this.candidates.live(lineId, stationId);

    return live
      ? {
          lineKey: live.lineKey,
          block: StationBlock.of(live.station),
          fingerprint: StationFingerprint.of(live.fingerprint),
          scoring: CandidateScoring.of(live.scoring),
        }
      : null;
  }

  async dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued> {
    const dispatched = await this.dispatching.enqueue({
      id: order.run.value,
      original: order.original.value,
      workspaceId: order.workspaceId.value,
      lineId: order.lineId,
      stationId: order.stationId,
      station: order.block.value,
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
          refusal: refusalOf(dispatched.refusal) ?? 'cannot-start',
        };
  }

  withdraw(runs: readonly RunId[]): Promise<void> {
    return this.dispatching.withdraw(runs.map((each) => each.value));
  }

  async forgo(run: RunId, keep: boolean): Promise<RunForgone> {
    const forgone = await this.dispatching.forgo(run.value, keep);

    return forgone.outcome === 'queued'
      ? {
          queued: true,
          fingerprint: forgone.fingerprint
            ? StationFingerprint.of(forgone.fingerprint)
            : null,
        }
      : { queued: false };
  }

  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void> {
    return this.holds.hold(
      holder,
      workspaceId.value,
      runs.map((each) => each.value),
    );
  }

  release(holder: string): Promise<void> {
    return this.holds.release(holder);
  }
}
