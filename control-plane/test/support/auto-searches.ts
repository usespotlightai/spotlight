import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { and, eq, inArray } from 'drizzle-orm';
import { autoSearched } from './app';
import * as schema from './schema';

export interface SearchPolicyTerms {
  readonly iterations: number;
  readonly ceiling: number;
  readonly repeats?: number;
  readonly objective?: 'success' | 'cost';
}

export interface SearchedStation {
  readonly app: INestApplication;
  readonly db: DrizzleDatabase;
  readonly lineId: string;
  readonly stationId: string;
}

export const policyAt = async (
  { db, lineId, stationId }: SearchedStation,
  terms: SearchPolicyTerms,
  line: { readonly monthlyCeiling?: number } = {},
): Promise<void> => {
  await db
    .update(schema.line)
    .set({
      search: {
        enabled: true,
        monthlyCeiling: line.monthlyCeiling ?? 1_000,
        currency: 'USD',
        ceiling: terms.ceiling,
        period: '7d',
        onAlert: true,
        cooldown: '1h',
      },
    })
    .where(eq(schema.line.id, lineId));
  await db
    .update(schema.station)
    .set({
      search: {
        enabled: null,
        ceiling: terms.ceiling,
        period: null,
        onAlert: null,
        cooldown: null,
        agent: { harness: 'claude-code', model: null, effort: 'high' },
        iterations: terms.iterations,
        repeats: terms.repeats ?? null,
        objective: terms.objective ?? null,
      },
    })
    .where(eq(schema.station.id, stationId));
};

export const scheduleOf = async ({ db, stationId }: SearchedStation) => {
  const [row] = await db
    .select()
    .from(schema.stationSearchSchedule)
    .where(eq(schema.stationSearchSchedule.stationId, stationId));

  return row;
};

export const dueNow = async (
  { db, stationId }: SearchedStation,
  over: { readonly lastStartedAt?: Date | null } = {},
): Promise<void> => {
  await db
    .update(schema.stationSearchSchedule)
    .set({
      checkAfter: new Date(0),
      ...(over.lastStartedAt === undefined
        ? {}
        : { lastStartedAt: over.lastStartedAt }),
    })
    .where(eq(schema.stationSearchSchedule.stationId, stationId));
};

export const activeSearchAt = async ({ db, stationId }: SearchedStation) => {
  const [row] = await db
    .select()
    .from(schema.replaySearch)
    .where(
      and(
        eq(schema.replaySearch.stationId, stationId),
        inArray(schema.replaySearch.state, [
          'seeding',
          'searching',
          'holding-out',
        ]),
      ),
    );

  return row;
};

export const searchStarted = async (
  at: SearchedStation,
  terms: SearchPolicyTerms,
): Promise<{ id: string; seedReplayId: string }> => {
  await policyAt(at, terms);
  await dueNow(at, { lastStartedAt: null });
  await autoSearched(at.app);

  const started = await activeSearchAt(at);

  if (!started) {
    throw new Error(
      `Spotlight started no search: ${(await scheduleOf(at))?.lastSkipReason ?? 'it waits'}`,
    );
  }

  return { id: started.id, seedReplayId: started.seedReplay.replayId };
};
