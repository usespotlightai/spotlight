import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { CONTROL_PLANE_SEQ } from '@runs/application/contracts/run-journal.contract';
import type { RunEventReaderPort } from '@runs/application/ports/run-event-reader.port';
import type { RunEventView } from '@runs/application/ports/run-stream.port';
import { runJournalEntry } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { and, asc, desc, eq, gt, lte } from 'drizzle-orm';

const MAX_CONTROL_PLANE_ENTRIES = 200;

const inPlace = (
  events: readonly RunEventView[],
  event: RunEventView,
): RunEventView[] => {
  const at = events.findIndex((each) => each.at > event.at);

  return at === -1
    ? [...events, event]
    : [...events.slice(0, at), event, ...events.slice(at)];
};

const viewOf = (row: {
  attempt: number;
  seq: number;
  type: string;
  at: Date;
  message: string | null;
  data: string | null;
}): RunEventView => ({
  attempt: row.attempt,
  seq: row.seq,
  type: row.type,
  at: row.at.toISOString(),
  message: row.message ?? undefined,
  data: row.data ?? undefined,
});

@Injectable()
export class DrizzleRunEventReader implements RunEventReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async eventsSince(
    runId: RunId,
    attempt: number,
    afterSeq: number,
    max: number,
  ): Promise<RunEventView[]> {
    const columns = {
      attempt: runJournalEntry.attempt,
      seq: runJournalEntry.seq,
      type: runJournalEntry.type,
      at: runJournalEntry.at,
      message: runJournalEntry.message,
      data: runJournalEntry.data,
    };
    const ofAttempt = and(
      eq(runJournalEntry.runId, runId.value),
      eq(runJournalEntry.attempt, attempt),
    );

    const entries = await this.db
      .select(columns)
      .from(runJournalEntry)
      .where(and(ofAttempt, gt(runJournalEntry.seq, afterSeq)))
      .orderBy(desc(runJournalEntry.seq))
      .limit(max);

    const controlPlaneEntries = await this.db
      .select(columns)
      .from(runJournalEntry)
      .where(and(ofAttempt, lte(runJournalEntry.seq, CONTROL_PLANE_SEQ)))
      .orderBy(desc(runJournalEntry.at), asc(runJournalEntry.seq))
      .limit(MAX_CONTROL_PLANE_ENTRIES);

    return controlPlaneEntries
      .reverse()
      .map(viewOf)
      .reduce(inPlace, entries.reverse().map(viewOf));
  }

  async lastOfType(
    runId: RunId,
    attempt: number,
    type: string,
  ): Promise<RunEventView | null> {
    const [found] = await this.db
      .select({
        attempt: runJournalEntry.attempt,
        seq: runJournalEntry.seq,
        type: runJournalEntry.type,
        at: runJournalEntry.at,
        message: runJournalEntry.message,
        data: runJournalEntry.data,
      })
      .from(runJournalEntry)
      .where(
        and(
          eq(runJournalEntry.runId, runId.value),
          eq(runJournalEntry.attempt, attempt),
          eq(runJournalEntry.type, type),
        ),
      )
      .orderBy(desc(runJournalEntry.at), desc(runJournalEntry.seq))
      .limit(1);

    return found ? viewOf(found) : null;
  }
}
