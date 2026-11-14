import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HARNESS_CONNECTED } from '@runs/domain/value-objects/journal-entry-type';
import { JournalSeq } from '@runs/domain/value-objects/journal-seq.vo';
import {
  isAcp1Journal,
  rewrittenAcp1Journal,
} from '@runs/infrastructure/journal/acp-1-journal';
import {
  run,
  runJournalEntry,
} from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, asc, eq, gte, isNotNull, isNull, or, sql } from 'drizzle-orm';

const INSERTED_AT_ONCE = 1_000;

export interface JournalAttempt {
  readonly runId: string;
  readonly attempt: number;
}

export interface RewrittenAttempt extends JournalAttempt {
  readonly before: number;
  readonly after: number;
}

const runnerRowsOf = ({ runId, attempt }: JournalAttempt) =>
  and(
    eq(runJournalEntry.runId, runId),
    eq(runJournalEntry.attempt, attempt),
    gte(runJournalEntry.seq, 1),
  );

const OLD_ROW = or(
  and(
    eq(runJournalEntry.type, 'output'),
    isNull(runJournalEntry.message),
    isNotNull(runJournalEntry.data),
  ),
  eq(runJournalEntry.type, 'usage'),
  and(eq(runJournalEntry.type, HARNESS_CONNECTED), isNull(runJournalEntry.data)),
);

const LIVE = sql`${run.state} = 'claimed' and ${run.attempt} = ${runJournalEntry.attempt}`;

export class DrizzleAcp1Journals {
  constructor(private readonly context: DrizzleContext) {}

  async attempts(runId: string | null): Promise<JournalAttempt[]> {
    return this.context.db
      .selectDistinct({
        runId: runJournalEntry.runId,
        attempt: runJournalEntry.attempt,
      })
      .from(runJournalEntry)
      .leftJoin(run, eq(run.id, runJournalEntry.runId))
      .where(
        and(
          gte(runJournalEntry.seq, 1),
          OLD_ROW,
          sql`not coalesce(${LIVE}, false)`,
          runId === null ? undefined : eq(runJournalEntry.runId, runId),
        ),
      )
      .orderBy(asc(runJournalEntry.runId), asc(runJournalEntry.attempt));
  }

  async rewrite(
    attempt: JournalAttempt,
    write: boolean,
  ): Promise<RewrittenAttempt | null> {
    return this.context.inTransaction(async () => {
      const rows = await this.context.db
        .select({
          seq: runJournalEntry.seq,
          type: runJournalEntry.type,
          at: runJournalEntry.at,
          message: runJournalEntry.message,
          data: runJournalEntry.data,
        })
        .from(runJournalEntry)
        .where(runnerRowsOf(attempt))
        .orderBy(asc(runJournalEntry.seq))
        .for('update');

      if (!isAcp1Journal(rows)) {
        return null;
      }

      const rewritten = rewrittenAcp1Journal(rows);
      const done = { ...attempt, before: rows.length, after: rewritten.length };
      if (!write) {
        return done;
      }

      await this.context.db.delete(runJournalEntry).where(runnerRowsOf(attempt));
      for (let from = 0; from < rewritten.length; from += INSERTED_AT_ONCE) {
        await this.context.db.insert(runJournalEntry).values(
          rewritten.slice(from, from + INSERTED_AT_ONCE).map((row) => ({
            runId: attempt.runId,
            attempt: attempt.attempt,
            seq: JournalSeq.fromRunner(row.seq).value,
            type: row.type,
            at: row.at,
            message: row.message,
            data: row.data,
          })),
        );
      }

      return done;
    });
  }
}
