import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK_RUN_LOOKUP = Symbol('WORK_RUN_LOOKUP');

export interface RunLocation {
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly lineName: string;
  readonly stationId: string;
  readonly stationName: string;
  readonly repositories: readonly Repository[];
}

export interface BriefedMemory {
  readonly id: string;
  readonly handle: string;
}

export interface RunLookup {
  readonly id: RunId;
  readonly harness: string;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly check: string | null;
  readonly setups: ReadonlyMap<string, string>;
  readonly placement: RunnerPlacement;
  readonly decisions: boolean;
  readonly memories: boolean;
  readonly briefedWith: {
    readonly briefed: readonly BriefedMemory[];
    readonly omitted: readonly BriefedMemory[];
  };
  readonly ended: boolean;
  readonly completed: boolean;
  readonly trial: boolean;
  readonly isolated: boolean;
  readonly checkouts: number;
}

export interface RunContext {
  readonly teamId: TeamId;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repositories: readonly Repository[];
}

export interface LeasedRunLookup extends RunContext {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly asOf: Date | null;
  readonly trial: boolean;
  readonly isolated: boolean;
}

export interface ReasonedStep {
  readonly index: number;
  readonly kind: 'message' | 'thought' | 'planned' | 'handover' | 'remember';
  readonly text: string;
}

export interface RunReasoning {
  readonly steps: readonly ReasonedStep[];
  readonly changed: readonly string[];
}

export interface ChangedFile {
  readonly repository: Repository;
  readonly path: string;
}

export interface FilesUnder {
  readonly folder: string;
  readonly extension: string;
}

export interface WorkRunLookupPort {
  run(runId: RunId): Promise<RunLookup | null>;

  leasedBy(runId: RunId, runner: RunnerId): Promise<LeasedRunLookup | null>;

  contextOfRun(runId: RunId): Promise<RunContext | null>;

  locationOf(runId: RunId): Promise<RunLocation | null>;

  filesReadUnder(
    runId: RunId,
    under: FilesUnder,
  ): Promise<readonly string[] | null>;

  reasoning(runId: RunId): Promise<RunReasoning | null>;

  changedBy(runId: RunId): Promise<readonly ChangedFile[] | null>;
}
