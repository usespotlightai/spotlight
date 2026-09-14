import type { OpenedPullRequestDto } from '@application/dto/pull-request.dto';
import type { PullRequestPort } from '@application/ports/pull-request.port';
import type { AnnounceTaskEvents } from '@application/services/announce-task-events';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { NoGitHubInstallationError } from '@domain/exceptions/no-github-installation.error';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';

interface PullRequestAsked {
  readonly title: string;
  readonly body: string;
  readonly repository: string | null;
}

export class OpenPullRequest {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly workspaces: WorkspaceConnections,
    private readonly pullRequests: PullRequestPort,
    private readonly announce: AnnounceTaskEvents,
  ) {}

  async open(
    task: Task,
    line: Line,
    asked: PullRequestAsked,
  ): Promise<OpenedPullRequestDto> {
    if (task.pullRequest) {
      return { url: task.pullRequest.value };
    }

    const repository = line.opening(asked.repository);

    const installation = GitHubInstallation.from(
      await this.workspaces.connectionTo(
        task.workspaceId,
        GitHubInstallation.SOURCE,
      ),
    );

    if (!installation) {
      throw new NoGitHubInstallationError();
    }

    const opened = await this.pullRequests.open({
      installation,
      repository,
      branch: task.branch.value,
      title: asked.title,
      body: asked.body,
    });

    const shared = task.openedAt(PullRequestUrl.of(opened.url));
    await this.tasks.save(shared);
    await this.announce.of(shared);

    return opened;
  }
}
