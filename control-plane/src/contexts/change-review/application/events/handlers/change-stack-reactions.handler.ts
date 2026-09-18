import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';

export class ChangeStackReactions {
  constructor(private readonly announcer: ChangeStackAnnouncerPort) {}

  async onSettled(event: ChangeStackSettled): Promise<void> {
    await this.announcer.ofRun(event.runId);
  }

  async onChecked(event: ChangeStackChecked): Promise<void> {
    await this.announcer.ofRun(event.runId);
  }
}
