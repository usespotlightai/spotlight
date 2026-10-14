import type { OracleAnswer } from '@replays/domain/services/oracle-answer';
import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { ReplayRefusal } from '@replays/domain/value-objects/replay-refusal';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('REPLAYS_WORK');

interface ConfigSourceAtHand {
  readonly repository: Repository;
  readonly path: string;
}

export interface StationAtHand {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly lineKey: string;
  readonly stationId: string;
  readonly key: string;
  readonly name: string;
  readonly source: ConfigSourceAtHand | null;
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
  readonly origin: string | null;
}

export interface PickableRun extends RunReplayability {
  readonly title: string;
  readonly state: string;
  readonly endedAt: Date;
  readonly origin: string | null;
}

export type ExaminedCandidate =
  | {
      readonly ok: true;
      readonly fingerprint: StationFingerprint;
      readonly digests: StationDigests;
      readonly liveDigests: StationDigests;
      readonly scoring: CandidateScoring;
      readonly changedFrom: StationChanges;
      readonly block: StationBlock;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface LiveConfig {
  readonly lineKey: string;
  readonly block: StationBlock;
  readonly fingerprint: StationFingerprint;
  readonly scoring: CandidateScoring;
  readonly digests: StationDigests;
  readonly threshold: ReplayThreshold | null;
}

export interface OracleAnswerAsked {
  readonly run: RunId;
  readonly answer: OracleAnswer;
}

export interface ReplayRunOrder {
  readonly run: RunId;
  readonly original: RunId;
  readonly workspaceId: WorkspaceId;
  readonly lineId: string;
  readonly stationId: string;
  readonly block: StationBlock;
  readonly line: PlannedLine | null;
  readonly answer: OracleAnswer | null;
}

export type ReplayRunQueued =
  | { readonly queued: true; readonly fingerprint: StationFingerprint | null }
  | { readonly queued: false; readonly refusal: ReplayRefusal };

export type RunForgone =
  | { readonly queued: false }
  | { readonly queued: true; readonly fingerprint: StationFingerprint | null };

export interface SearchRunOrder {
  readonly run: RunId;
  readonly searchId: SearchId;
  readonly iteration: number;
  readonly lineId: string;
  readonly stationId: string;
  readonly agent: SearchAgent;
  readonly briefing: string;
}

export type SearchRunQueued =
  | { readonly queued: true }
  | { readonly queued: false; readonly reason: string };

export interface HeldSearchRun {
  readonly searchId: SearchId;
  readonly iteration: number;
}

export interface SearchRunStanding {
  readonly run: RunId;
  readonly phase: 'queued' | 'running' | 'ended';
  readonly failed: boolean;
  readonly started: boolean;
  readonly queuedAt: Date;
  readonly endedAt: Date | null;
}

export type UnclaimedWithdrawal =
  | { readonly outcome: 'withdrawn'; readonly started: boolean }
  | { readonly outcome: 'claimed' }
  | { readonly outcome: 'ended' };

export interface AgentRefusal {
  readonly field: 'harness' | 'model' | 'effort';
  readonly reason: string;
}

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
    line?: PlannedLine | null,
  ): Promise<ExaminedCandidate | null>;

  live(lineId: string, stationId: string): Promise<LiveConfig | null>;

  dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued>;

  answerable(asked: readonly OracleAnswerAsked[]): Promise<readonly RunId[]>;

  withdraw(runs: readonly RunId[]): Promise<void>;

  forgo(run: RunId, keep: boolean): Promise<RunForgone>;

  durations(runs: readonly RunId[]): Promise<ReadonlyMap<string, number>>;

  agentRefusal(agent: SearchAgent): AgentRefusal | null;

  dispatchSearch(order: SearchRunOrder): Promise<SearchRunQueued>;

  withdrawSearch(run: RunId): Promise<void>;

  withdrawUnclaimedSearch(run: RunId): Promise<UnclaimedWithdrawal>;

  heldSearchRun(run: RunId, runnerId: string): Promise<HeldSearchRun | null>;

  searchRunStandings(
    runs: readonly RunId[],
  ): Promise<readonly SearchRunStanding[]>;

  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void>;

  release(holder: string): Promise<void>;
}
