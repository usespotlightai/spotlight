import type { AnnounceDecisions } from '@change-review/application/services/announce-decisions.service';
import type { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import type { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DecisionReactions {
  constructor(private readonly announcer: AnnounceDecisions) {}

  async onRecorded(event: DecisionsRecorded): Promise<void> {
    await this.announcer.ofTask(event.taskId);
  }

  async onDisputed(event: DecisionDisputed): Promise<void> {
    await this.announcer.ofTask(event.taskId);
  }

  async onPullRequestOpened(taskId: TaskId): Promise<void> {
    await this.announcer.ofTask(taskId);
  }
}
