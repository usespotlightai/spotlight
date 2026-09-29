import { RUN_PAUSED } from '@work/application/contracts/run-journal.contract';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import type { RunPaused } from '@work/domain/events/run-paused.event';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

export class PauseMarks {
  constructor(private readonly journal: RunJournalPort) {}

  async onRunPaused(event: RunPaused): Promise<void> {
    await this.journal.appendAside(RunAttempt.of(event.runId, event.attempt), {
      type: RUN_PAUSED,
      at: event.at,
      message: 'Waiting for a person',
    });
  }
}
