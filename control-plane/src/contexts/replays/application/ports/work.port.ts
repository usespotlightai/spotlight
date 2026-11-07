import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
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
  readonly lineId: LineId;
  readonly lineKey: string;
  readonly stationId: StationId;
  readonly key: string;
  readonly name: string;
  readonly source: ConfigSourceView | null;
}

export interface RunReplayability {
  readonly runId: RunId;
  readonly taskId: TaskId | null;
  readonly stationId: StationId | null;
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
  readonly search: SearchPolicy | null;
  readonly agent: SearchAgent | null;
}

export interface WorkPort {
  station(lineId: LineId, stationId: StationId): Promise<StationView | null>;

  findStation(stationId: StationId): Promise<StationView | null>;

  keyed(lineId: LineId, key: string): Promise<StationView | null>;

  runSummaries(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly RunSummary[]>;

  recentAt(
    workspaceId: WorkspaceId,
    stationId: StationId,
    max: number,
  ): Promise<readonly PickableRun[]>;

  validate(
    lineId: LineId,
    stationId: StationId,
    block: unknown,
    line?: PlannedLine | null,
  ): Promise<ValidatedCandidate | null>;

  live(lineId: LineId, stationId: StationId): Promise<LiveConfig | null>;

  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void>;

  release(holder: string): Promise<void>;
}
