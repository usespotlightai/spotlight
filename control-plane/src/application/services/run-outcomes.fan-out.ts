import type { RunOutcomes } from '@application/services/run-outcomes';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';

// Order matters: handing the task on runs first and must not be held up by the rest.
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
