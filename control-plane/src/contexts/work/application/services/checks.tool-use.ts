import type { CheckRunsPort } from '@github/application/ports/check-runs.port';
import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { TaskLookupReaderPort } from '@work/application/ports/task-lookup-reader.port';
import { NoPullRequestError } from '@work/domain/exceptions/no-pull-request.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { CHECKS } from '@work/domain/value-objects/built-in-tools';

export class ChecksToolUse implements BuiltInToolUse<TaskToolContext> {
  readonly tool = CHECKS;

  constructor(
    private readonly tasks: TaskLookupReaderPort,
    private readonly checkRuns: CheckRunsPort,
  ) {}

  async call({ taskId, workspaceId }: TaskToolContext): Promise<unknown> {
    const task = await this.tasks.find(taskId);

    if (!task) {
      throw new UnknownTaskError(taskId.value);
    }

    const pullRequests = task.reviewedPullRequest
      ? [task.reviewedPullRequest.url]
      : task.pullRequests;

    if (pullRequests.length === 0) {
      throw new NoPullRequestError(taskId.value);
    }

    const read = await Promise.allSettled(
      pullRequests.map(async (pullRequest) => ({
        pullRequest: pullRequest.value,
        ...(await this.checkRuns.failedOn(workspaceId, pullRequest)),
      })),
    );
    const [firstRead] = read;

    if (
      firstRead?.status === 'rejected' &&
      read.every((each) => each.status === 'rejected')
    ) {
      throw firstRead.reason;
    }

    return {
      pullRequests: read.map((each, at) =>
        each.status === 'fulfilled'
          ? each.value
          : {
              pullRequest: pullRequests[at]?.value,
              error:
                each.reason instanceof Error
                  ? each.reason.message
                  : String(each.reason),
            },
      ),
    };
  }
}
