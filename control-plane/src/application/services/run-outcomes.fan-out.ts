import type { RunOutcomes } from '@application/services/run-outcomes';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';

/**
 * What a finished run means to more than one part of the system: where the
 * task goes next, and what the run came to. Told in order, because handing the
 * task on is the part that must not be held up by anything else.
 */
export class RunOutcomesFanOut implements RunOutcomes {
  private readonly told: readonly RunOutcomes[];

  constructor(...told: readonly RunOutcomes[]) {
    this.told = told;
  }

  async onRunCompleted(event: RunCompleted): Promise<void> {
    for (const each of this.told) {
      await each.onRunCompleted(event);
    }
  }

  async onRunAbandoned(event: RunAbandoned): Promise<void> {
    for (const each of this.told) {
      await each.onRunAbandoned(event);
    }
  }
}
