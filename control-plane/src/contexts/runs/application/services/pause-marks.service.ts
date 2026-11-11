import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunPaused } from '@runs/domain/events/run-paused.event';
import { RUN_PAUSED } from '@runs/domain/value-objects/journal-entry-type';

export class PauseMarks {
  constructor(private readonly journal: RunJournalPort) {}

  async onRunPaused(event: RunPaused): Promise<void> {
    await this.journal.appendControlPlaneEntry(event.attempt, {
      type: RUN_PAUSED,
      at: event.at,
      resumesAtOnce: event.resumesAtOnce,
    });
  }
}
