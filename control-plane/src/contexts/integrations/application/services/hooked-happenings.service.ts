import type { HookFirings } from '@integrations/application/services/hook-firings.service';
import type { PullRequestClosedIntegrationEvent } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { TaskMovedIntegrationEvent } from '@shared-kernel/application/integration-events/task-moved.integration-event';
import type { TaskOpenedIntegrationEvent } from '@shared-kernel/application/integration-events/task-opened.integration-event';
import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';

export class HookedHappenings {
  constructor(
    private readonly firings: HookFirings,
    private readonly tasks: HookedTasksPort,
  ) {}

  async runEnded(event: RunEndedIntegrationEvent): Promise<void> {
    const task = event.taskId
      ? await this.tasks.of(event.taskId, event.runId)
      : null;

    if (task) {
      await this.firings.happened({
        on: 'run.ended',
        occurrence: `run-ended:${event.runId}`,
        task,
        event: { outcome: event.outcome },
      });
    }
  }

  async taskOpened(event: TaskOpenedIntegrationEvent): Promise<void> {
    const task = await this.tasks.of(event.taskId, null);

    if (task) {
      await this.firings.happened({
        on: 'task.opened',
        occurrence: `task-opened:${event.taskId}`,
        task,
        event: {},
      });
    }
  }

  async taskMoved(event: TaskMovedIntegrationEvent): Promise<void> {
    const task = await this.tasks.of(event.taskId, null);

    if (task) {
      await this.firings.happened({
        on: 'task.moved',
        occurrence: `task-moved:${event.taskId}:${event.at}`,
        task,
        event: { from: event.from, to: event.to },
      });
    }
  }

  async pullRequestClosed(
    event: PullRequestClosedIntegrationEvent,
  ): Promise<void> {
    if (!event.merged) {
      return;
    }

    const task = await this.tasks.ofPullRequest(
      event.workspaceId,
      event.pullRequest,
    );

    if (task) {
      await this.firings.happened({
        on: 'pull-request.merged',
        occurrence: `pull-request-merged:${event.pullRequest}`,
        task,
        event: {
          url: event.pullRequest,
          repository: event.repository,
          mergeCommit: event.mergeCommit,
        },
        matchedLater: true,
      });
    }
  }
}
