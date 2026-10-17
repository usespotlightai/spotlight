import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { actsOutsideSpotlight } from '@change-review/domain/services/replay-isolation';

export class ChangeStackReactions {
  constructor(private readonly announcer: ChangeStackAnnouncerPort) {}

  async onCompleted(event: ChangeStackCompleted): Promise<void> {
    if (actsOutsideSpotlight(event)) {
      await this.announcer.ofRun(event.runId);
    }
  }

  async onChecked(event: ChangeStackChecked): Promise<void> {
    if (actsOutsideSpotlight(event)) {
      await this.announcer.ofRun(event.runId);
    }
  }
}
