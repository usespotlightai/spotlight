import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { CommentBodiesPort } from '@change-review/application/ports/comment-bodies.port';
import type { ReviewLinksPort } from '@change-review/application/ports/review-links.port';
import type { StickyCommentPosterPort } from '@change-review/application/ports/sticky-comment-poster.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { WorkspacesPort } from '@change-review/application/ports/workspaces.port';
import { actsOutsideSpotlight } from '@change-review/domain/services/trial-isolation';
import type { PullRequestCommentsPort } from '@github/application/ports/pull-request-comments.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class PostChangeStackComment implements StickyCommentPosterPort {
  constructor(
    private readonly stacks: ChangeStackReaderPort,
    private readonly workspaces: WorkspacesPort,
    private readonly work: WorkPort,
    private readonly connections: WorkspaceConnectionsPort,
    private readonly comments: PullRequestCommentsPort,
    private readonly clock: ClockPort,
    private readonly links: ReviewLinksPort,
    private readonly bodies: CommentBodiesPort,
  ) {}

  async ofRun(runId: RunId): Promise<void> {
    const run = await this.work.run(runId);

    if (run?.taskId && actsOutsideSpotlight(run)) {
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

    await this.comments.upsert({
      workspaceId: task.workspaceId,
      repository,
      pullRequest: task.pullRequest,
      marker: this.bodies.changeStackMarker,
      body: this.bodies.changeStack(
        latest,
        this.links.changeStackOf({
          slug,
          teamId: task.teamId,
          runId: latest.runId,
        }),
      ),
    });
  }
}
