import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ASIDE_SEQ } from '@work/application/contracts/run-journal.contract';
import type {
  AsideEntry,
  JournalEntry,
  RunJournalPort,
} from '@work/application/ports/run-journal.port';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { runJournalEntry } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, eq, lte, min } from 'drizzle-orm';

const ASIDE_TRIES = 5;

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

  async appendAside(attempt: RunAttempt, entry: AsideEntry): Promise<number> {
    for (let tried = 1; ; tried++) {
      const [lowest] = await this.context.db
        .select({ seq: min(runJournalEntry.seq) })
        .from(runJournalEntry)
        .where(
          and(
            eq(runJournalEntry.runId, attempt.runId.value),
            eq(runJournalEntry.attempt, attempt.number),
            lte(runJournalEntry.seq, ASIDE_SEQ),
          ),
        );
      const seq = lowest?.seq == null ? ASIDE_SEQ : lowest.seq - 1;

      const written = await this.context.db
        .insert(runJournalEntry)
        .values({
          runId: attempt.runId.value,
          attempt: attempt.number,
          seq,
          type: entry.type,
          at: entry.at,
          message: entry.message ?? null,
          data: entry.data ?? null,
        })
        .onConflictDoNothing({
          target: [
            runJournalEntry.runId,
            runJournalEntry.attempt,
            runJournalEntry.seq,
          ],
        })
        .returning({ seq: runJournalEntry.seq });

      if (written.length > 0) {
        return seq;
      }

      if (tried >= ASIDE_TRIES) {
        throw new Error(
          `Found no free place aside in the journal of run ${attempt.runId.value} after ${ASIDE_TRIES} tries`,
        );
      }
    }
  }
}
