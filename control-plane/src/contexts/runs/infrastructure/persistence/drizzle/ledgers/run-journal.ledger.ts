import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  ControlPlaneEntry,
  JournalEntry,
  RunJournalPort,
} from '@runs/application/ports/run-journal.port';
import { JournalSeq } from '@runs/domain/value-objects/journal-seq.vo';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { encodedFacts } from '@runs/infrastructure/journal/control-plane-facts';
import { runJournalEntry } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, eq, lte, min } from 'drizzle-orm';

const CONTROL_PLANE_ENTRY_TRIES = 5;

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

  async appendControlPlaneEntry(
    attempt: RunAttempt,
    entry: ControlPlaneEntry,
  ): Promise<JournalEntry> {
    const data = encodedFacts(entry);

    for (let tried = 1; ; tried++) {
      const [lowest] = await this.context.db
        .select({ seq: min(runJournalEntry.seq) })
        .from(runJournalEntry)
        .where(
          and(
            eq(runJournalEntry.runId, attempt.runId.value),
            eq(runJournalEntry.attempt, attempt.number),
            lte(runJournalEntry.seq, JournalSeq.firstControlPlane),
          ),
        );
      const seq = JournalSeq.controlPlaneBelow(lowest?.seq ?? null).value;

      const written = await this.context.db
        .insert(runJournalEntry)
        .values({
          runId: attempt.runId.value,
          attempt: attempt.number,
          seq,
          type: entry.type,
          at: entry.at,
          message: null,
          data,
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
        return { seq, type: entry.type, at: entry.at, data };
      }

      if (tried >= CONTROL_PLANE_ENTRY_TRIES) {
        throw new Error(
          `Found no free control-plane place in the journal of run ${attempt.runId.value} after ${CONTROL_PLANE_ENTRY_TRIES} tries`,
        );
      }
    }
  }
}
