import type { OracleAnswer } from '@replays/domain/services/oracle-answer';
import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('REPLAYS_WORK');

interface ConfigSourceView {
  readonly repository: Repository;
  readonly path: string;
}

export interface StationView {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly lineKey: string;
  readonly stationId: string;
  readonly key: string;
  readonly name: string;
  readonly source: ConfigSourceView | null;
}

export interface RunReplayability {
  readonly runId: RunId;
  readonly taskId: TaskId | null;
  readonly stationId: string | null;
  readonly unreplayableReason: UnreplayableReason | null;
  readonly reason: string | null;
}

export interface RunSummary extends RunReplayability {
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

export type ValidatedCandidate =
  | {
      readonly ok: true;
      readonly fingerprint: StationFingerprint;
      readonly hashes: StationHashes;
      readonly liveHashes: StationHashes;
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
  readonly hashes: StationHashes;
  readonly threshold: ReplayThreshold | null;
}

export interface OracleAnswerInput {
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
  | { readonly queued: false; readonly unreplayableReason: UnreplayableReason };

export type CancelledRun =
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

export interface LeasedSearchRun {
  readonly searchId: SearchId;
  readonly iteration: number;
}

export interface SearchRunStatus {
  readonly run: RunId;
  readonly phase: 'queued' | 'running' | 'ended';
  readonly failed: boolean;
  readonly started: boolean;
  readonly queuedAt: Date;
  readonly endedAt: Date | null;
}

export type UnclaimedCancellation =
  | { readonly outcome: 'cancelled'; readonly started: boolean }
  | { readonly outcome: 'claimed' }
  | { readonly outcome: 'ended' };

export interface AgentProblem {
  readonly field: 'harness' | 'model' | 'effort';
  readonly reason: string;
}

export interface WorkPort {
  station(lineId: string, stationId: string): Promise<StationView | null>;

  findStation(stationId: string): Promise<StationView | null>;

  keyed(lineId: string, key: string): Promise<StationView | null>;

  runSummaries(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly RunSummary[]>;

  recentAt(
    workspaceId: WorkspaceId,
    stationId: string,
    max: number,
  ): Promise<readonly PickableRun[]>;

  validate(
    lineId: string,
    stationId: string,
    block: unknown,
    line?: PlannedLine | null,
  ): Promise<ValidatedCandidate | null>;

  live(lineId: string, stationId: string): Promise<LiveConfig | null>;

  dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued>;

  answerable(inputs: readonly OracleAnswerInput[]): Promise<readonly RunId[]>;

  cancelQueued(runs: readonly RunId[]): Promise<void>;

  cancel(run: RunId, leaveRunAsIs: boolean): Promise<CancelledRun>;

  durations(runs: readonly RunId[]): Promise<ReadonlyMap<string, number>>;

  agentProblem(agent: SearchAgent): AgentProblem | null;

  dispatchSearch(order: SearchRunOrder): Promise<SearchRunQueued>;

  cancelSearchRun(run: RunId): Promise<void>;

  cancelUnclaimedSearchRun(run: RunId): Promise<UnclaimedCancellation>;

  leasedSearchRun(
    run: RunId,
    runnerId: string,
  ): Promise<LeasedSearchRun | null>;

  searchRunStatuses(
    runs: readonly RunId[],
  ): Promise<readonly SearchRunStatus[]>;

  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void>;

  release(holder: string): Promise<void>;
}
