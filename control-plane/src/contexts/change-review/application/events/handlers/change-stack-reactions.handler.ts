import type { StickyCommentPosterPort } from '@change-review/application/ports/sticky-comment-poster.port';
import type { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import type { StackChecked } from '@change-review/domain/events/stack-checked.event';
import { actsOutsideSpotlight } from '@change-review/domain/services/trial-isolation';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ChangeStackReactions {
  constructor(private readonly poster: StickyCommentPosterPort) {}

  async onCompleted(event: ChangeStackCompleted): Promise<void> {
    if (actsOutsideSpotlight(event)) {
      await this.posted(event);
    }
  }

  async onChecked(event: StackChecked): Promise<void> {
    if (actsOutsideSpotlight(event)) {
      await this.posted(event);
    }
  }

  private async posted(event: {
    readonly runId: RunId | null;
    readonly taskId: TaskId | null;
  }): Promise<void> {
    if (event.runId) {
      await this.poster.ofRun(event.runId);
    } else if (event.taskId) {
      await this.poster.ofTask(event.taskId);
    }
  }
}
