import type {
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import type { QueueHookFirings } from '@integrations/application/services/queue-hook-firings.service';
import { CauseLinks } from '@integrations/domain/services/cause-links';
import type { PullRequestClosedIntegrationEvent } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { TaskMovedIntegrationEvent } from '@shared-kernel/application/integration-events/task-moved.integration-event';
import type { TaskOpenedIntegrationEvent } from '@shared-kernel/application/integration-events/task-opened.integration-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ToolUsed {
  readonly tool: string;
  readonly event: Readonly<Record<string, unknown>>;
}

export class LifecycleHookTriggers {
  constructor(
    private readonly firings: QueueHookFirings,
    private readonly tasks: TasksForHooksPort,
  ) {}

  async toolUsed(
    task: TaskView,
    used: ToolUsed,
    occurrence: string,
  ): Promise<void> {
    await this.firings.queue({
      on: 'tool.used',
      occurrence,
      change: CauseLinks.toolUsed(used.tool, occurrence),
      task,
      event: used.event,
    });
  }

  async runEnded(event: RunEndedIntegrationEvent): Promise<void> {
    const task = event.taskId
      ? await this.tasks.of(TaskId.of(event.taskId), RunId.of(event.runId))
      : null;

    if (task) {
      await this.firings.queue({
        on: 'run.ended',
        occurrence: `run-ended:${event.runId}`,
        change: event.outcome,
        task,
        event: { outcome: event.outcome },
      });
    }
  }

  async taskOpened(event: TaskOpenedIntegrationEvent): Promise<void> {
    const task = await this.tasks.of(TaskId.of(event.taskId), null);

    if (task) {
      await this.firings.queue({
        on: 'task.opened',
        occurrence: `task-opened:${event.taskId}`,
        change: task.stationKey.value,
        task,
        event: {},
      });
    }
  }

  async taskMoved(event: TaskMovedIntegrationEvent): Promise<void> {
    const task = await this.tasks.of(TaskId.of(event.taskId), null);

    if (task) {
      await this.firings.queue({
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
      WorkspaceId.of(event.workspaceId),
      PullRequestUrl.of(event.pullRequest),
    );

    if (task) {
      await this.firings.queue({
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
