import type { PostDecisionsComment } from '@change-review/application/services/post-decisions-comment.service';
import type { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import type { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DecisionReactions {
  constructor(private readonly poster: PostDecisionsComment) {}

  async onRecorded(event: DecisionsRecorded): Promise<void> {
    await this.poster.ofTask(event.taskId);
  }

  async onDisputed(event: DecisionDisputed): Promise<void> {
    await this.poster.ofTask(event.taskId);
  }

  async onPullRequestOpened(taskId: TaskId): Promise<void> {
    await this.poster.ofTask(taskId);
  }
}
