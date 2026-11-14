import type { AppendedJournalEntry } from '@runs/application/commands/runner.commands';
import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import { ReportedJournalEntry } from '@runs/domain/value-objects/reported-journal-entry.vo';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';

export class RunJournalAppends {
  constructor(
    private readonly journal: RunJournalPort,
    private readonly stream: RunStreamPort,
  ) {}

  async append(
    attempt: RunAttempt,
    entries: readonly AppendedJournalEntry[],
  ): Promise<void> {
    const reported = entries.map((entry) => ReportedJournalEntry.of(entry));

    await this.journal.append(
      attempt,
      reported.map((entry) => ({
        seq: entry.seq.value,
        type: entry.type,
        at: entry.at,
        message: entry.message,
        data: entry.data,
      })),
    );
    this.stream.publish(
      attempt.runId.value,
      entries.map((entry) => ({
        attempt: attempt.number,
        seq: entry.seq,
        type: entry.type,
        at: entry.at,
        message: entry.message,
        data: entry.data,
      })),
    );
  }
}
