import type {
  RunSite,
  StationSite,
} from '@memory/domain/value-objects/run-site';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('WORK');

export interface NamedStationSite extends StationSite {
  readonly lineName: string;
  readonly stationName: string;
}

export interface RememberedRun {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly completed: boolean;
  readonly memories: boolean;
  readonly briefed: readonly string[];
  readonly cut: readonly string[];
}

export interface HeldRun extends RunSite {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly replaysFrom: Date | null;
  readonly isSearch: boolean;
}

export interface RememberedTask {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly fromOutside: boolean;
}

export interface ReasonedStep {
  readonly index: number;
  readonly kind: string;
  readonly text: string;
}

export interface ChangedFile {
  readonly repository: Repository;
  readonly path: string;
}

export interface SpokenNote {
  readonly position: number;
  readonly by: 'person' | 'world';
  readonly author: UserId | null;
  readonly text: string;
}

export interface TeamLine {
  readonly id: string;
  readonly name: string;
  readonly stations: readonly { readonly id: string; readonly name: string }[];
  readonly repositories: readonly Repository[];
}

export interface WorkPort {
  run(runId: RunId): Promise<RememberedRun | null>;

  heldBy(runId: RunId, runner: RunnerId): Promise<HeldRun | null>;

  siteOfRun(runId: RunId): Promise<RunSite | null>;

  referencedUnder(
    runId: RunId,
    folder: string,
    file: RegExp,
  ): Promise<readonly string[] | null>;

  stationSiteOf(runId: RunId): Promise<NamedStationSite | null>;

  linesOf(teamId: TeamId): Promise<readonly TeamLine[]>;

  task(taskId: TaskId): Promise<RememberedTask | null>;

  reasoning(runId: RunId): Promise<readonly ReasonedStep[] | null>;

  changedBy(runId: RunId): Promise<readonly ChangedFile[] | null>;

  spokenOn(taskId: TaskId): Promise<readonly SpokenNote[] | null>;

  harnessOf(runId: RunId): Promise<string | null>;
}
