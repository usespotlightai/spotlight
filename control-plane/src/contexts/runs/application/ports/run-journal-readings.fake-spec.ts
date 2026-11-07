import type { RunJournalReadingsPort } from '@runs/application/ports/run-journal-readings.port';
import { RunJournalReadings } from '@runs/application/services/run-journal-readings.service';

export const runJournalReadings = (): RunJournalReadingsPort =>
  new RunJournalReadings();
