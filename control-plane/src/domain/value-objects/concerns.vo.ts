import { Branch } from '@domain/value-objects/branch.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

/** Which task something out in the world is about. */
export class Concerns {
  private constructor(
    readonly taskId: TaskId | null,
    readonly pullRequest: PullRequestUrl | null,
  ) {}

  static of(input: {
    branch?: string | null;
    pullRequest?: string | null;
  }): Concerns | null {
    const named = input.branch ? Branch.of(input.branch).taskId : null;
    const opened = input.pullRequest
      ? PullRequestUrl.of(input.pullRequest)
      : null;

    return named || opened ? new Concerns(named, opened) : null;
  }
}
