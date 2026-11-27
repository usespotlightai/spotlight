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

interface BriefedMemory {
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
  readonly working: boolean;
  readonly attempt: number;
  readonly orderedAt: Date | null;
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

/** A spotlight command that a step ran, read as the CLI read it. */
export interface ReasonedCommand {
  readonly name: 'remember' | 'forget' | 'handover';
  /**
   * The prose the CLI received inline: the body of `remember`, the reason of `forget`, the note of `handover`. Null
   * where the script gave it another way, such as `--body -` from stdin.
   */
  readonly argument: string | null;
  /** The command alone, for a person to read. */
  readonly shown: string;
}

export interface ReasonedStep {
  readonly index: number;
  readonly kind: 'message' | 'thought' | 'planned' | 'handover' | 'remember';
  /** The step as a person reads it: a spotlight command alone, the first where it ran several. */
  readonly text: string;
  /** Each spotlight command the step ran, in order: more than one where one step ran several. */
  readonly commands: readonly ReasonedCommand[];
}

export interface RunReasoning {
  readonly steps: readonly ReasonedStep[];
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

  reasoning(
    runId: RunId,
    throughAttempt: number | null,
  ): Promise<RunReasoning | null>;
}
