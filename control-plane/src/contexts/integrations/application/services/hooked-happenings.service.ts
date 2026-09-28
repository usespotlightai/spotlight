import type { TasksForHooksPort } from '@integrations/application/ports/tasks-for-hooks.port';
import type { FireHooks } from '@integrations/application/services/fire-hooks.service';
import type { PullRequestClosedIntegrationEvent } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { TaskMovedIntegrationEvent } from '@shared-kernel/application/integration-events/task-moved.integration-event';
import type { TaskOpenedIntegrationEvent } from '@shared-kernel/application/integration-events/task-opened.integration-event';

export class HookedHappenings {
  constructor(
    private readonly firings: FireHooks,
    private readonly tasks: TasksForHooksPort,
  ) {}

  async runEnded(event: RunEndedIntegrationEvent): Promise<void> {
    const task = event.taskId
      ? await this.tasks.of(event.taskId, event.runId)
      : null;

    if (task) {
      await this.firings.happened({
        on: 'run.ended',
        occurrence: `run-ended:${event.runId}`,
        change: event.outcome,
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
        change: task.stationKey,
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
        change: `${event.from} → ${event.to}`,
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
        change: event.pullRequest,
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
