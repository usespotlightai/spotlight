import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';
import { reachesBeyondSpotlight } from '@change-review/domain/services/replay-isolation';

export class ChangeStackReactions {
  constructor(private readonly announcer: ChangeStackAnnouncerPort) {}

  async onSettled(event: ChangeStackSettled): Promise<void> {
    if (reachesBeyondSpotlight(event)) {
      await this.announcer.ofRun(event.runId);
    }
  }

  async onChecked(event: ChangeStackChecked): Promise<void> {
    if (reachesBeyondSpotlight(event)) {
      await this.announcer.ofRun(event.runId);
    }
  }
}
