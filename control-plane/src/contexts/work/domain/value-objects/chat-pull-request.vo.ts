import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ChatPullRequest {
  private constructor(
    readonly task: TaskId,
    readonly url: PullRequestUrl,
  ) {}

  static of(input: { task: TaskId; url: PullRequestUrl }): ChatPullRequest {
    return new ChatPullRequest(input.task, input.url);
  }
}
