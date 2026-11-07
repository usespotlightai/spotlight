import type { UnfinishedRun } from '@insights/domain/services/unfinished-runs';
import type { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('INSIGHTS_WORK');

export interface EndedRun {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly taskId: TaskId;
  readonly fingerprint: ConfigFingerprint | null;
  readonly visit: number;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profileKey: string | null;
  readonly repositories: readonly string[];
  readonly skills: readonly string[];
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date;
}

export interface TaskRun {
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly teamId: TeamId;
}

export interface ConfigPart {
  readonly part: string;
  readonly name: string | null;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly was: string | null;
  readonly now: string | null;
}

export interface StationConfigView {
  readonly prompt: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profile: { readonly key: string; readonly settings: unknown } | null;
  readonly image: string | null;
  readonly repositories: readonly {
    readonly name: string;
    readonly setup: string | null;
  }[];
  readonly skills: readonly { readonly key: string; readonly hash: string }[];
  readonly tools: readonly string[];
  readonly decisions: boolean;
  readonly memories: boolean;
  readonly judge?: {
    readonly rubricVersion: string;
    readonly sample: number;
    readonly minAgreement: number;
  };
}

export interface ConfigInOrder {
  readonly fingerprint: string;
  readonly config: StationConfigView;
  readonly changes: readonly ConfigPart[];
}

export interface TracedStation {
  readonly stationId: string;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly count: number;
}

interface TracedTask {
  readonly taskId: string;
  readonly title: string;
  readonly input: string | null;
  readonly stationId: string;
}

export interface TracedWork {
  readonly tasks: readonly TracedTask[];
  readonly stations: readonly TracedStation[];
  readonly outputs: ReadonlyMap<string, string>;
}

export interface TracedWanted {
  readonly taskIds: readonly string[];
  readonly runIds: readonly string[];
  readonly stationIds: readonly string[];
}

export interface WorkPort {
  endedRun(runId: RunId): Promise<EndedRun | null>;

  taskRunOf(runId: RunId): Promise<TaskRun | null>;

  unfinishedRuns(teamId: TeamId): Promise<readonly UnfinishedRun[]>;

  traced(wanted: TracedWanted): Promise<TracedWork>;

  configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly ConfigInOrder[]>;
}
