import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunPaused } from '@runs/domain/events/run-paused.event';

export class PauseMarks {
  constructor(private readonly journal: RunJournalPort) {}

  async onRunPaused(event: RunPaused): Promise<void> {
    await this.journal.appendControlPlaneEntry(event.attempt, {
      type: 'run.paused',
      at: event.at,
      resumesAtOnce: event.resumesAtOnce,
    });
  }
}
