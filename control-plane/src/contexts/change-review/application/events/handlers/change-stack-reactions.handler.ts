import type { StickyCommentPosterPort } from '@change-review/application/ports/sticky-comment-poster.port';
import type { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import type { StackChecked } from '@change-review/domain/events/stack-checked.event';
import { actsOutsideSpotlight } from '@change-review/domain/services/trial-isolation';

export class ChangeStackReactions {
  constructor(private readonly poster: StickyCommentPosterPort) {}

  async onCompleted(event: ChangeStackCompleted): Promise<void> {
    if (actsOutsideSpotlight(event)) {
      await this.poster.ofRun(event.runId);
    }
  }

  async onChecked(event: StackChecked): Promise<void> {
    if (actsOutsideSpotlight(event)) {
      await this.poster.ofRun(event.runId);
    }
  }
}
