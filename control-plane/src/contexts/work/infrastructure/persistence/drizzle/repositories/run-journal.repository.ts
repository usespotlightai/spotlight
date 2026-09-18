import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  JournalEntry,
  RunJournalPort,
} from '@work/application/ports/run-journal.port';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { runJournalEntry } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';

@Injectable()
export class DrizzleRunJournal implements RunJournalPort {
  constructor(private readonly context: DrizzleContext) {}

  async append(
    attempt: RunAttempt,
    entries: readonly JournalEntry[],
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    await this.context.db
      .insert(runJournalEntry)
      .values(
        entries.map((entry) => ({
          runId: attempt.runId.value,
          attempt: attempt.number,
          seq: entry.seq,
          type: entry.type,
          at: entry.at,
          message: entry.message ?? null,
          data: entry.data ?? null,
        })),
      )
      .onConflictDoNothing({
        target: [
          runJournalEntry.runId,
          runJournalEntry.attempt,
          runJournalEntry.seq,
        ],
      });
  }
}
