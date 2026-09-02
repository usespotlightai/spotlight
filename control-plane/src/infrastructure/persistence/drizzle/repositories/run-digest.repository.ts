import type { RunDigestReaderPort } from '@application/ports/run-digest-reader.port';
import type { RunDigestWriterPort } from '@application/ports/run-digest-writer.port';
import { outcomeOf, type RunOutcome } from '@domain/services/run-outcome';
import { Money } from '@domain/value-objects/money.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { TERMINAL_RUN_STATES } from '@domain/value-objects/run-state';
import { Told } from '@infrastructure/acp/told';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  run,
  runDigest,
  runEvent,
} from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm';

/** How many runs are read into memory at once while catching up. */
const AT_A_TIME = 25;

const chunked = <T>(all: readonly T[], size: number): T[][] => {
  const batches: T[][] = [];

  for (let at = 0; at < all.length; at += size) {
    batches.push(all.slice(at, at + size));
  }

  return batches;
};

@Injectable()
export class DrizzleRunDigests
  implements RunDigestReaderPort, RunDigestWriterPort
{
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async ensure(runIds: readonly RunId[]): Promise<void> {
    const ids = [...new Set(runIds.map((each) => each.value))];

    if (ids.length === 0) {
      return;
    }

    await this.write(inArray(run.id, ids));
  }

  async catchUp(): Promise<void> {
    await this.write();
  }

  /** Every finished run without a digest, of those the filter admits. */
  private async write(only?: SQL): Promise<void> {
    const owed = await this.db
      .select({ id: run.id, attempt: run.attempt })
      .from(run)
      .leftJoin(
        runDigest,
        and(eq(runDigest.runId, run.id), eq(runDigest.attempt, run.attempt)),
      )
      .where(
        and(
          only,
          inArray(run.state, [...TERMINAL_RUN_STATES]),
          isNull(runDigest.runId),
        ),
      );

    for (const batch of chunked(owed, AT_A_TIME)) {
      await this.digest(batch);
    }
  }

  private async digest(
    owed: readonly { id: string; attempt: number }[],
  ): Promise<void> {
    const told = await this.db
      .select({
        runId: runEvent.runId,
        attempt: runEvent.attempt,
        type: runEvent.type,
        at: runEvent.at,
        message: runEvent.message,
        data: runEvent.data,
      })
      .from(runEvent)
      .where(
        inArray(
          runEvent.runId,
          owed.map((each) => each.id),
        ),
      )
      .orderBy(asc(runEvent.runId), asc(runEvent.seq));

    const readings = new Map<string, Told>();
    for (const row of told) {
      const reading = readings.get(`${row.runId}:${row.attempt}`) ?? new Told();
      reading.take(row);
      readings.set(`${row.runId}:${row.attempt}`, reading);
    }

    const rows = owed.map(({ id, attempt }) => {
      const reading = readings.get(`${id}:${attempt}`) ?? new Told();
      const spent = reading.spent();

      // What a run came to is the domain's reckoning, not this table's: all
      // that happens here is reading the journal and keeping the answer.
      const outcome = outcomeOf({
        ms: reading.ms(),
        statuses: reading.steps().map((step) => step.status),
        used: spent?.used ?? null,
        size: spent?.size ?? null,
        cost: spent?.cost ?? null,
      });

      return {
        runId: id,
        attempt,
        ms: outcome.ms,
        steps: outcome.steps,
        faults: outcome.faults,
        used: outcome.used,
        size: outcome.size,
        cost: outcome.cost?.amount ?? null,
        currency: outcome.cost?.currency ?? null,
        readable: reading.readable,
      };
    });

    if (rows.length === 0) {
      return;
    }

    // A run finishing while its history is being caught up would otherwise
    // collide here, and the two would have written the same thing anyway.
    await this.db.insert(runDigest).values(rows).onConflictDoNothing();
  }

  async forRuns(runIds: readonly RunId[]): Promise<Map<string, RunOutcome>> {
    const ids = [...new Set(runIds.map((each) => each.value))];

    if (ids.length === 0) {
      return new Map();
    }

    const held = await this.db
      .select({
        runId: runDigest.runId,
        ms: runDigest.ms,
        steps: runDigest.steps,
        faults: runDigest.faults,
        used: runDigest.used,
        size: runDigest.size,
        cost: runDigest.cost,
        currency: runDigest.currency,
      })
      .from(runDigest)
      .where(inArray(runDigest.runId, ids))
      // A retried run has a digest per attempt; the last is what it came to.
      .orderBy(asc(runDigest.attempt));

    return new Map(
      held.map((each) => [
        each.runId,
        {
          ms: each.ms,
          steps: each.steps,
          faults: each.faults,
          used: each.used,
          size: each.size,
          cost: Money.maybe(each.cost, each.currency),
        },
      ]),
    );
  }
}
