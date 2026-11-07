import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskViewFields {
  readonly taskId?: string;
  readonly workspaceId?: string;
  readonly teamId?: string;
  readonly title?: string;
  readonly url?: string;
  readonly line?: string;
  readonly station?: string;
  readonly stationKey?: string;
  readonly marks?: Readonly<Record<string, string>>;
  readonly repositories?: readonly string[];
  readonly pullRequest?: string | null;
  readonly runId?: string | null;
}

export const taskViewOf = (fields: TaskViewFields = {}): TaskView => {
  const runId = fields.runId === undefined ? 'run_1' : fields.runId;

  return {
    taskId: TaskId.of(fields.taskId ?? 'task_1'),
    workspaceId: WorkspaceId.of(fields.workspaceId ?? 'workspace_1'),
    teamId: TeamId.of(fields.teamId ?? 'team_1'),
    title: fields.title ?? 'Add a column',
    url: fields.url ?? 'https://spotlight.example.com/t/1',
    line: fields.line ?? 'delivery',
    station: fields.station ?? 'Implementation',
    stationKey: StationKey.of(fields.stationKey ?? 'implementation'),
    marks: fields.marks ?? {},
    repositories: fields.repositories ?? ['acme/api'],
    pullRequest: fields.pullRequest ?? null,
    runId: runId === null ? null : RunId.of(runId),
  };
};
