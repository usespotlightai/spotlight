import type { OpenPullRequestCommand } from '@application/commands/open-pull-request.command';
import type { OpenedPullRequestDto } from '@application/dto/pull-request.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { PullRequestPort } from '@application/ports/pull-request.port';
import type { RunAtHand } from '@application/services/run-at-hand.service';
import { NoGitHubInstallationError } from '@domain/exceptions/no-github-installation.error';
import { NoRepositoryError } from '@domain/exceptions/no-repository.error';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';

export class OpenPullRequestHandler
  implements CommandHandlerPort<OpenPullRequestCommand, OpenedPullRequestDto>
{
  constructor(
    private readonly held: RunAtHand,
    private readonly tasks: TaskRepository,
    private readonly workspaces: WorkspaceConnections,
    private readonly pullRequests: PullRequestPort,
  ) {}

  async execute(
    command: OpenPullRequestCommand,
  ): Promise<OpenedPullRequestDto> {
    try {
      const { task } = await this.held.heldBy(command.runId, command.runnerId);

      if (!task?.repository) {
        throw new NoRepositoryError();
      }

      // One task, one pull request: a station run again does not open another.
      if (task.pullRequest) {
        return { url: task.pullRequest.value };
      }

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
        repository: task.repository,
        branch: task.branch.value,
        title: command.title,
        body: command.body,
      });

      await this.tasks.save(task.openedAt(PullRequestUrl.of(opened.url)));

      return opened;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
