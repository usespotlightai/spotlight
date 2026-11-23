import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { DrizzleRunWaits } from '@runs/infrastructure/persistence/drizzle/ledgers/run-waits.ledger';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { requestedBySpec } from './support/runs';
import * as schema from './support/schema';

const QUEUED_AT = new Date('2026-01-02T03:00:00.000Z');
const NOTED_AT = new Date('2026-01-02T03:01:00.000Z');
const LATER = new Date('2026-01-02T03:11:00.000Z');

let database: TestDatabase;
let waits: DrizzleRunWaits;
let facts: RunReadModel;

beforeAll(async () => {
  database = await openDatabase('run_waits');
  const context = new DrizzleContext(database.db);
  waits = new DrizzleRunWaits(context);
  facts = new RunReadModel(new DrizzleRunFactsReader(context));
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const queued = async (queuedAt = QUEUED_AT): Promise<RunId> => {
  const id = randomUUID();

  await database.db.insert(schema.run).values({
    id,
    workspaceId: 'ws_1',
    harness: 'dev',
    state: 'queued',
    ...requestedBySpec(id),
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    },
    queuedAt,
  });

  return RunId.of(id);
};

const waitingOf = async (runId: RunId) =>
  (await facts.of([runId]))[0]?.waiting ?? null;

describe('why a queued run waits', () => {
  it('keeps the time it first noted a reason while the reason stays', async () => {
    const runId = await queued();

    await waits.note(
      [{ runId, reason: 'no-pool-has-room', queuedAt: QUEUED_AT }],
      NOTED_AT,
    );
    await waits.note(
      [{ runId, reason: 'no-pool-has-room', queuedAt: QUEUED_AT }],
      LATER,
    );

    expect(await waitingOf(runId)).toEqual({
      reason: 'no-pool-has-room',
      since: NOTED_AT,
    });
  });

  it('starts the time again for a new reason', async () => {
    const runId = await queued();

    await waits.note(
      [{ runId, reason: 'no-pool-has-room', queuedAt: QUEUED_AT }],
      NOTED_AT,
    );
    await waits.note(
      [{ runId, reason: 'hosts-pull', queuedAt: QUEUED_AT }],
      LATER,
    );

    expect(await waitingOf(runId)).toEqual({
      reason: 'hosts-pull',
      since: LATER,
    });
  });

  it('starts the time again once the run is queued again', async () => {
    const requeuedAt = new Date(LATER.getTime() - 1_000);
    const runId = await queued(requeuedAt);

    await waits.note(
      [{ runId, reason: 'no-pool-matches', queuedAt: QUEUED_AT }],
      NOTED_AT,
    );

    expect(await waitingOf(runId)).toBeNull();

    await waits.note(
      [{ runId, reason: 'no-pool-matches', queuedAt: requeuedAt }],
      LATER,
    );

    expect(await waitingOf(runId)).toEqual({
      reason: 'no-pool-matches',
      since: LATER,
    });
  });

  it('says nothing for a run that is no longer queued', async () => {
    const runId = await queued();

    await waits.note(
      [{ runId, reason: 'no-pool-matches', queuedAt: QUEUED_AT }],
      NOTED_AT,
    );
    await database.db
      .update(schema.run)
      .set({
        state: 'claimed',
        claimedBy: 'runner_1',
        leaseExpiresAt: LATER,
        version: 1,
      })
      .where(and(eq(schema.run.id, runId.value), eq(schema.run.version, 0)));

    expect(await waitingOf(runId)).toBeNull();
  });
});
