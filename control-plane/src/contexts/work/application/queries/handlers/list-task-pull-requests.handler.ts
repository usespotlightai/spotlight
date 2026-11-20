import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskPullRequestDto } from '@work/application/dto/task-pull-request.dto';
import type { TaskPullRequestStatesPort } from '@work/application/ports/task-pull-request-states.port';
import type { TaskReaderPort } from '@work/application/ports/task-reader.port';
import type { ListTaskPullRequestsQuery } from '@work/application/queries/list-task-pull-requests.query';
import type { WorkAccess } from '@work/application/services/work-access.service';

export class ListTaskPullRequestsHandler implements QueryHandlerPort<
  ListTaskPullRequestsQuery,
  TaskPullRequestDto[] | null
> {
  constructor(
    private readonly tasks: TaskReaderPort,
    private readonly states: TaskPullRequestStatesPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(
    query: ListTaskPullRequestsQuery,
  ): Promise<TaskPullRequestDto[] | null> {
    try {
      const teamId = TeamId.of(query.teamId);
      const team = await this.access.seenTeam(
        teamId,
        UserId.of(query.viewerId),
      );
      const task =
        team && (await this.tasks.findInTeam(teamId, TaskId.of(query.taskId)));

      if (!team || !task) {
        return null;
      }

      const known = await this.states.of(
        team.workspaceId,
        task.pullRequests.map((url) => PullRequestUrl.of(url)),
      );

      return task.pullRequests.map((url) => ({
        url,
        state: known.get(url) ?? null,
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
