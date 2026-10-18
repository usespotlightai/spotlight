import type { StickyCommentPosterPort } from '@change-review/application/ports/sticky-comment-poster.port';
import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { actsOutsideSpotlight } from '@change-review/domain/services/replay-isolation';

export class ChangeStackReactions {
  constructor(private readonly poster: StickyCommentPosterPort) {}

  async onCompleted(event: ChangeStackCompleted): Promise<void> {
    if (actsOutsideSpotlight(event)) {
      await this.poster.ofRun(event.runId);
    }
  }

  async onChecked(event: ChangeStackChecked): Promise<void> {
    if (actsOutsideSpotlight(event)) {
      await this.poster.ofRun(event.runId);
    }
  }
}
