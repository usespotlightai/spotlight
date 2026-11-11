import type { LinkedTaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
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

export const taskViewOf = (fields: TaskViewFields = {}): LinkedTaskView => {
  const runId = fields.runId === undefined ? 'run_1' : fields.runId;

  return {
    taskId: TaskId.of(fields.taskId ?? 'task_1'),
    workspaceId: WorkspaceId.of(fields.workspaceId ?? 'workspace_1'),
    teamId: TeamId.of(fields.teamId ?? 'team_1'),
    title: fields.title ?? 'Add a column',
    url: fields.url ?? 'https://spotlight.example.com/t/1',
    line: LineKey.of(fields.line ?? 'delivery'),
    station: StationName.of(fields.station ?? 'Implementation'),
    stationKey: StationKey.of(fields.stationKey ?? 'implementation'),
    marks: fields.marks ?? {},
    repositories: (fields.repositories ?? ['acme/api']).map(Repository.of),
    pullRequest: fields.pullRequest
      ? PullRequestUrl.of(fields.pullRequest)
      : null,
    pullRequests: fields.pullRequest
      ? [PullRequestUrl.of(fields.pullRequest)]
      : [],
    runId: runId === null ? null : RunId.of(runId),
    waiting: null,
  };
};
