import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { PullRequestHookDeniedError } from '@work/domain/exceptions/pull-request-hook-denied.error';

export class PullRequestOpeningHook {
  constructor(
    private readonly taskViews: TaskViewsPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly pullRequests: PullRequestPort,
  ) {}

  async allows(input: {
    task: Task;
    runId: RunId | null;
    repository: Repository;
    title: string;
  }): Promise<void> {
    const view = await this.taskViews.of(
      input.task.id.value,
      input.runId?.value ?? null,
    );

    if (
      !view ||
      !(await this.hooks.listens(view.teamId, 'pull-request.opening'))
    ) {
      return;
    }

    const decision = await this.hooks.before(view, {
      on: 'pull-request.opening',
      repository: input.repository.value,
      branch: input.task.branch.value,
      title: input.title,
      changed: await this.pullRequests.changedOn(
        input.task.workspaceId,
        input.repository,
        input.task.branch.value,
      ),
    });

    if (decision.kind === 'denied') {
      throw new PullRequestHookDeniedError(decision.reason);
    }
  }
}
