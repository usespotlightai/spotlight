import type {
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import type { QueueHookFirings } from '@integrations/application/services/queue-hook-firings.service';
import { HookOccurrence } from '@integrations/domain/value-objects/hook-occurrence.vo';
import type { PullRequestClosedIntegrationEvent } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { TaskMovedIntegrationEvent } from '@shared-kernel/application/integration-events/task-moved.integration-event';
import type { TaskOpenedIntegrationEvent } from '@shared-kernel/application/integration-events/task-opened.integration-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ToolUsed {
  readonly tool: Tool;
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
    await this.firings.queue(
      task,
      HookOccurrence.toolUsed(used.tool, occurrence, used.event),
    );
  }

  async runEnded(event: RunEndedIntegrationEvent): Promise<void> {
    const run = RunId.of(event.runId);
    const task = event.taskId
      ? await this.tasks.of(TaskId.of(event.taskId), run)
      : null;

    if (task) {
      await this.firings.queue(
        task,
        HookOccurrence.runEnded(run, event.outcome),
      );
    }
  }

  async taskOpened(event: TaskOpenedIntegrationEvent): Promise<void> {
    const task = await this.tasks.of(TaskId.of(event.taskId), null);

    if (task) {
      await this.firings.queue(
        task,
        HookOccurrence.taskOpened(task.taskId, task.stationKey),
      );
    }
  }

  async taskMoved(event: TaskMovedIntegrationEvent): Promise<void> {
    const task = await this.tasks.of(TaskId.of(event.taskId), null);

    if (task) {
      await this.firings.queue(
        task,
        HookOccurrence.taskMoved(task.taskId, {
          from: event.from,
          to: event.to,
          at: event.at,
        }),
      );
    }
  }

  async pullRequestClosed(
    event: PullRequestClosedIntegrationEvent,
  ): Promise<void> {
    if (!event.merged) {
      return;
    }

    const pullRequest = PullRequestUrl.of(event.pullRequest);
    const task = await this.tasks.ofPullRequest(
      WorkspaceId.of(event.workspaceId),
      pullRequest,
    );

    if (task) {
      await this.firings.queue(
        task,
        HookOccurrence.pullRequestMerged(
          pullRequest,
          Repository.of(event.repository),
          event.mergeCommit,
        ),
      );
    }
  }
}
