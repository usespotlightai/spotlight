import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunSpent } from '@work/application/contracts/run-journal.contract';
import type {
  RunDigest,
  RunDigestReaderPort,
} from '@work/application/ports/run-digest-reader.port';
import type { RunDigestWriterPort } from '@work/application/ports/run-digest-writer.port';
import { Money } from '@work/domain/value-objects/money.vo';
import { TERMINAL_RUN_STATES } from '@work/domain/value-objects/run-state';
import { faulted } from '@work/domain/value-objects/step-status';
import { Told } from '@work/infrastructure/acp/told';
import {
  run,
  runDigest,
  runJournalEntry,
} from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, asc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';

const AT_A_TIME = 25;

interface Worked {
  readonly ms: number | null;
  readonly statuses: readonly (string | null)[];
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: Money | null;
}

export const spentAcross = (readings: readonly Told[]): RunSpent | null => {
  const latest =
    readings
      .map((reading) => reading.spent())
      .filter((each) => each !== null)
      .pop() ?? null;
  const bySession = new Map<string, RunSpent>();

  for (const reading of readings) {
    for (const [session, spent] of reading.spentBySession()) {
      bySession.set(session, spent);
    }
  }

  const costs = [...bySession.values()].flatMap((each) =>
    each.cost && each.cost.currency === latest?.cost?.currency
      ? [each.cost]
      : [],
  );

  return latest
    ? {
        ...latest,
        cost: costs.reduce<Money | null>(
          (sum, cost) => (sum ? sum.plus(cost) : cost),
          null,
        ),
      }
    : null;
};

export const digestOf = (worked: Worked): RunDigest => ({
  ms: worked.ms,
  steps: worked.statuses.length,
  faults: worked.statuses.filter(faulted).length,
  used: worked.used,
  size: worked.size,
  cost: worked.cost,
});

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

  private async write(only?: SQL): Promise<void> {
    const owed = await this.db
      .select({
        id: run.id,
        attempt: run.attempt,
        parked: run.parkedAttempts,
      })
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
    owed: readonly {
      id: string;
      attempt: number;
      parked: readonly number[];
    }[],
  ): Promise<void> {
    const told = await this.db
      .select({
        runId: runJournalEntry.runId,
        attempt: runJournalEntry.attempt,
        type: runJournalEntry.type,
        at: runJournalEntry.at,
        message: runJournalEntry.message,
        data: runJournalEntry.data,
      })
      .from(runJournalEntry)
      .where(
        or(
          ...owed.map(({ id, attempt, parked }) =>
            and(
              eq(runJournalEntry.runId, id),
              inArray(runJournalEntry.attempt, [...parked, attempt]),
            ),
          ),
        ),
      )
      .orderBy(
        asc(runJournalEntry.runId),
        asc(runJournalEntry.attempt),
        asc(runJournalEntry.seq),
      );

    const readings = new Map<string, Told>();
    for (const row of told) {
      const reading = readings.get(`${row.runId}:${row.attempt}`) ?? new Told();
      reading.take(row);
      readings.set(`${row.runId}:${row.attempt}`, reading);
    }

    const rows = owed.map(({ id, attempt, parked }) => {
      const kept = [...parked, attempt]
        .sort((one, other) => one - other)
        .map((each) => readings.get(`${id}:${each}`) ?? new Told());
      const spent = spentAcross(kept);
      const took = kept
        .map((reading) => reading.ms())
        .filter((each) => each !== null);

      const digest = digestOf({
        ms: took.length > 0 ? took.reduce((sum, ms) => sum + ms, 0) : null,
        statuses: kept.flatMap((reading) =>
          reading.steps().map((step) => step.status),
        ),
        used: spent?.used ?? null,
        size: spent?.size ?? null,
        cost: spent?.cost ?? null,
      });

      return {
        runId: id,
        attempt,
        ms: digest.ms,
        steps: digest.steps,
        faults: digest.faults,
        used: digest.used,
        size: digest.size,
        cost: digest.cost?.amount ?? null,
        currency: digest.cost?.currency ?? null,
      };
    });

    if (rows.length === 0) {
      return;
    }

    await this.db.insert(runDigest).values(rows).onConflictDoNothing();
  }

  async forRuns(runIds: readonly RunId[]): Promise<Map<string, RunDigest>> {
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
