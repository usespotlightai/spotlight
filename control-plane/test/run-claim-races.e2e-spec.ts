import { randomUUID } from 'node:crypto';

import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunClaims } from '@runs/application/services/run-claims.service';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { DrizzleExclusiveClaimLocks } from '@runs/infrastructure/persistence/drizzle/exclusive-claim-locks';
import { DrizzleRunWaits } from '@runs/infrastructure/persistence/drizzle/ledgers/run-waits.ledger';
import { DrizzleRunRepository } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleWorkingCopyArchiveRepository } from '@runs/infrastructure/persistence/drizzle/repositories/working-copy-archive.repository';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { requestedBySpec, requestedByTask } from './support/runs';
import * as schema from './support/schema';

const NOW = new Date('2026-01-02T03:04:05.000Z');

let database: TestDatabase;
let db: DrizzleDatabase;
let runs: DrizzleRunRepository;
let claims: RunClaims;

beforeAll(async () => {
  database = await openDatabase('run_claim_races');
  db = database.db;

  const context = new DrizzleContext(db);
  const events = { dispatch: async () => {} };

  runs = new DrizzleRunRepository(context, events);
  claims = new RunClaims(
    runs,
    telemetryInMemory(),
    { linkActiveSpanTo: async () => {} },
    new DrizzleExclusiveClaimLocks(context),
    new DrizzleWorkingCopyArchiveRepository(context, events),
    new DrizzleRunWaits(context),
    {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  );
}, 60_000);

afterAll(async () => {
  await database.close();
});

interface Queue {
  readonly specRuns: number;
  readonly taskRuns: number;
  readonly taskAlreadyLeased: boolean;
  readonly runners: number;
}

const queue: fc.Arbitrary<Queue> = fc.record({
  specRuns: fc.integer({ min: 0, max: 3 }),
  taskRuns: fc.integer({ min: 0, max: 3 }),
  taskAlreadyLeased: fc.boolean(),
  runners: fc.integer({ min: 2, max: 5 }),
});

const SPEC = {
  command: { executable: 'sh', args: [] },
  briefing: 'do the thing',
  handover: { options: [], noteLimit: 0 },
  resume: {},
};

interface Queued {
  readonly workspaceId: string;
  readonly taskId: string;
  readonly specRuns: readonly string[];
  readonly taskRuns: readonly string[];
  readonly leasedTaskRun: string | null;
}

const queued = async (input: Queue): Promise<Queued> => {
  const workspaceId = `ws_${randomUUID()}`;
  const taskId = randomUUID();
  const inserted = async (
    state: 'queued' | 'claimed',
    requested: ReturnType<typeof requestedBySpec>,
    id = randomUUID(),
  ) => {
    await db.insert(schema.run).values({
      id,
      workspaceId,
      harness: 'dev',
      state,
      ...(state === 'claimed'
        ? {
            claimedBy: 'runner_earlier',
            leaseExpiresAt: new Date(NOW.getTime() + 60_000),
          }
        : {}),
      placement: [],
      ...requested,
      spec: SPEC,
    });

    return id;
  };

  const specRuns: string[] = [];
  for (let each = 0; each < input.specRuns; each++) {
    const id = randomUUID();
    specRuns.push(await inserted('queued', requestedBySpec(id), id));
  }

  const taskRuns: string[] = [];
  for (let each = 0; each < input.taskRuns; each++) {
    taskRuns.push(await inserted('queued', requestedByTask(taskId)));
  }

  const leasedTaskRun = input.taskAlreadyLeased
    ? await inserted('claimed', requestedByTask(taskId))
    : null;

  return { workspaceId, taskId, specRuns, taskRuns, leasedTaskRun };
};

const claimant = (workspaceId: string) => ({
  runner: RunnerId.of(`runner_${randomUUID()}`),
  workspaceId: WorkspaceId.of(workspaceId),
  harnesses: [HarnessId.of('dev')],
  offer: RunnerOffer.of([]),
  claims: 'any' as const,
  source: null,
});

interface Raced {
  readonly input: Queue;
  readonly queued: Queued;
  readonly handed: readonly { readonly runner: RunnerId; readonly run: Run }[];
  readonly stored: readonly Run[];
}

const stored = async (id: string): Promise<Run> => {
  const run = await runs.findById(RunId.of(id));

  if (!run) {
    throw new Error(`Run ${id} is gone after the race.`);
  }

  return run;
};

const taskRunsOf = (setUp: Queued): readonly string[] => [
  ...setUp.taskRuns,
  ...(nonEmpty(setUp.leasedTaskRun) ? [setUp.leasedTaskRun] : []),
];

const raced = async (input: Queue): Promise<Raced> => {
  const setUp = await queued(input);
  const claimants = Array.from({ length: input.runners }, () =>
    claimant(setUp.workspaceId),
  );
  const results = await Promise.all(
    claimants.map((each) => claims.next(each, NOW)),
  );

  return {
    input,
    queued: setUp,
    handed: results.flatMap((run, at) =>
      run ? [{ runner: claimants[at].runner, run }] : [],
    ),
    stored: await Promise.all(
      [...setUp.specRuns, ...taskRunsOf(setUp)].map(stored),
    ),
  };
};

const RUNS = { numRuns: 60 };

const race = (holds: (result: Raced) => boolean) =>
  fc.asyncProperty(queue, async (input) => holds(await raced(input)));

describe('runners claiming from one queue at the same moment', () => {
  it('hands each run to one runner at most', async () => {
    await fc.assert(
      race(({ handed }) => {
        const ids = handed.map((each) => each.run.id.value);

        return new Set(ids).size === ids.length;
      }),
      RUNS,
    );
  }, 120_000);

  it('stores the claim of the runner it was handed to', async () => {
    await fc.assert(
      race(({ handed, stored: after }) =>
        handed.every((each) => {
          const run = after.find((one) => one.id.equals(each.run.id));

          return (
            run?.state === 'claimed' &&
            (run.claimedBy?.equals(each.runner) ?? false)
          );
        }),
      ),
      RUNS,
    );
  }, 120_000);

  it('leases one run of a task at a time', async () => {
    await fc.assert(
      race(({ queued: setUp, stored: after }) => {
        const taskRuns = new Set(taskRunsOf(setUp));

        return (
          after.filter(
            (run) => taskRuns.has(run.id.value) && run.state === 'claimed',
          ).length <= 1
        );
      }),
      RUNS,
    );
  }, 120_000);

  it('hands out every run it can while runners are left', async () => {
    await fc.assert(
      race(({ input, queued: setUp, handed }) => {
        const claimable =
          setUp.specRuns.length +
          (setUp.taskRuns.length > 0 && !nonEmpty(setUp.leasedTaskRun) ? 1 : 0);

        return handed.length === Math.min(claimable, input.runners);
      }),
      RUNS,
    );
  }, 120_000);
});
