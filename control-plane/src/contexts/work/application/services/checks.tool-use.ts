import type { CheckRunsPort } from '@github/application/ports/check-runs.port';
import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import { NoPullRequestError } from '@work/domain/exceptions/no-pull-request.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { CHECKS } from '@work/domain/services/built-in-tools';

export class ChecksToolUse implements BuiltInToolUse<TaskToolContext> {
  readonly tool = CHECKS;

  constructor(
    private readonly tasks: TaskRepository,
    private readonly checkRuns: CheckRunsPort,
  ) {}

  async call({ taskId, workspaceId }: TaskToolContext): Promise<unknown> {
    const task = await this.tasks.find(taskId);

    if (!task) {
      throw new UnknownTaskError(taskId.value);
    }

    if (!task.pullRequest) {
      throw new NoPullRequestError(taskId.value);
    }

    const checks = await this.checkRuns.failedOn(workspaceId, task.pullRequest);

    return { pullRequest: task.pullRequest.value, ...checks };
  }
}
