import { namedDisputes } from '@change-review/application/mappers/named-disputes';
import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import type { GitHubConnectionsPort } from '@change-review/application/ports/github-connections.port';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type { ReviewLinksPort } from '@change-review/application/ports/review-links.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { WorkspacesPort } from '@change-review/application/ports/workspaces.port';
import {
  DECISIONS_MARKER,
  DecisionsComment,
} from '@change-review/application/rendering/decisions-comment';
import type { PullRequestCommentsPort } from '@github/application/ports/pull-request-comments.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class AnnounceDecisions {
  constructor(
    private readonly decisions: DecisionReaderPort,
    private readonly work: WorkPort,
    private readonly workspaces: WorkspacesPort,
    private readonly connections: GitHubConnectionsPort,
    private readonly comments: PullRequestCommentsPort,
    private readonly links: ReviewLinksPort,
    private readonly people: PeoplePort,
  ) {}

  async ofTask(taskId: TaskId): Promise<void> {
    const task = await this.work.task(taskId);
    const repository = task?.pullRequest?.repository ?? null;

    if (!task?.pullRequest || !repository || !task.teamId || task.reviewing) {
      return;
    }

    const found = await this.decisions.ofTask(taskId);

    if (!found?.runId) {
      return;
    }

    const slug = await this.workspaces.slugOf(task.workspaceId);

    if (!slug || !(await this.connections.isConnected(task.workspaceId))) {
      return;
    }

    const place = {
      workspaceId: task.workspaceId,
      repository,
      pullRequest: task.pullRequest,
      marker: DECISIONS_MARKER,
    };

    if (found.decisions.length === 0) {
      await this.comments.withdraw(place);
      return;
    }

    await this.comments.keep({
      ...place,
      body: DecisionsComment.of(
        {
          ...found,
          decisions: await namedDisputes(found.decisions, this.people),
        },
        repository,
        this.links.decisionsOf({
          slug,
          teamId: task.teamId.value,
          taskId: taskId.value,
        }),
      ),
    });
  }
}
