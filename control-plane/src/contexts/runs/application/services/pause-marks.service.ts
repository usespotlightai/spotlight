import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunPaused } from '@runs/domain/events/run-paused.event';
import { RUN_PAUSED } from '@runs/domain/value-objects/journal-entry-type';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';

export class PauseMarks {
  constructor(private readonly journal: RunJournalPort) {}

  async onRunPaused(event: RunPaused): Promise<void> {
    await this.journal.appendControlPlaneEntry(
      RunAttempt.of(event.runId, event.attempt),
      {
        type: RUN_PAUSED,
        at: event.at,
        message: event.resumesAtOnce
          ? 'Messages came in during the turn. The run starts again to read them.'
          : 'Waiting for a person',
      },
    );
  }
}
