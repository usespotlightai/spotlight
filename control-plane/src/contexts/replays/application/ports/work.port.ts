import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { ReplayRefusal } from '@replays/domain/value-objects/replay-refusal';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('REPLAYS_WORK');

export interface StationAtHand {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly lineKey: string;
  readonly stationId: string;
  readonly key: string;
  readonly name: string;
}

export interface RunReplayability {
  readonly runId: RunId;
  readonly taskId: TaskId | null;
  readonly stationId: string | null;
  readonly refusal: ReplayRefusal | null;
  readonly reason: string | null;
}

export interface StandingRun extends RunReplayability {
  readonly title: string | null;
  readonly state: string | null;
  readonly endedAt: Date | null;
}

export interface PickableRun extends RunReplayability {
  readonly title: string;
  readonly state: string;
  readonly endedAt: Date;
}

export type ExaminedCandidate =
  | {
      readonly ok: true;
      readonly fingerprint: StationFingerprint;
      readonly scoring: CandidateScoring;
      readonly changedFrom: StationChanges;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface LiveConfig {
  readonly lineKey: string;
  readonly block: StationBlock;
  readonly fingerprint: StationFingerprint;
  readonly scoring: CandidateScoring;
}

export interface ReplayRunOrder {
  readonly run: RunId;
  readonly original: RunId;
  readonly workspaceId: WorkspaceId;
  readonly lineId: string;
  readonly stationId: string;
  readonly block: StationBlock;
}

export type ReplayRunQueued =
  | { readonly queued: true; readonly fingerprint: StationFingerprint | null }
  | { readonly queued: false; readonly refusal: ReplayRefusal };

export type RunForgone =
  | { readonly queued: false }
  | { readonly queued: true; readonly fingerprint: StationFingerprint | null };

export interface WorkPort {
  station(lineId: string, stationId: string): Promise<StationAtHand | null>;

  keyed(lineId: string, key: string): Promise<StationAtHand | null>;

  replayable(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly RunReplayability[]>;

  standing(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly StandingRun[]>;

  recentAt(
    workspaceId: WorkspaceId,
    stationId: string,
    most: number,
  ): Promise<readonly PickableRun[]>;

  examine(
    lineId: string,
    stationId: string,
    block: unknown,
  ): Promise<ExaminedCandidate | null>;

  live(lineId: string, stationId: string): Promise<LiveConfig | null>;

  dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued>;

  withdraw(runs: readonly RunId[]): Promise<void>;

  forgo(run: RunId, keep: boolean): Promise<RunForgone>;

  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void>;

  release(holder: string): Promise<void>;
}
