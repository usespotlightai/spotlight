import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { GitHubConnectionsPort } from '@change-review/application/ports/github-connections.port';
import type { ReviewLinksPort } from '@change-review/application/ports/review-links.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { WorkspacesPort } from '@change-review/application/ports/workspaces.port';
import {
  CHANGE_STACK_MARKER,
  ChangeStackComment,
} from '@change-review/application/rendering/change-stack-comment';
import { reachesBeyondSpotlight } from '@change-review/domain/services/replay-isolation';
import type { PullRequestCommentsPort } from '@github/application/ports/pull-request-comments.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class AnnounceChangeStack implements ChangeStackAnnouncerPort {
  constructor(
    private readonly stacks: ChangeStackReaderPort,
    private readonly workspaces: WorkspacesPort,
    private readonly work: WorkPort,
    private readonly connections: GitHubConnectionsPort,
    private readonly comments: PullRequestCommentsPort,
    private readonly clock: ClockPort,
    private readonly links: ReviewLinksPort,
  ) {}

  async ofRun(runId: RunId): Promise<void> {
    const run = await this.work.run(runId);

    if (run?.taskId && reachesBeyondSpotlight(run)) {
      await this.ofTask(run.taskId);
    }
  }

  async ofTask(taskId: TaskId): Promise<void> {
    const task = await this.work.task(taskId);
    const repository = task?.pullRequest?.repository ?? null;

    if (!task?.pullRequest || !repository) {
      return;
    }

    const latest = await this.stacks.latestForTask(taskId, this.clock.now());
    const slug = latest ? await this.workspaces.slugOf(task.workspaceId) : null;

    if (latest?.state !== 'ready' || !slug || !task.teamId) {
      return;
    }

    if (!(await this.connections.isConnected(task.workspaceId))) {
      return;
    }

    await this.comments.keep({
      workspaceId: task.workspaceId,
      repository,
      pullRequest: task.pullRequest,
      marker: CHANGE_STACK_MARKER,
      body: ChangeStackComment.of(
        latest,
        this.links.changeStackOf({
          slug,
          teamId: task.teamId.value,
          runId: latest.runId,
        }),
      ),
    });
  }
}
