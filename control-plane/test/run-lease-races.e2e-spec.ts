import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import { CompleteRunHandler } from '@runs/application/commands/handlers/complete-run.handler';
import { RenewLeaseHandler } from '@runs/application/commands/handlers/renew-lease.handler';
import {
  CompleteRunCommand,
  RenewLeaseCommand,
} from '@runs/application/commands/runner.commands';
import type { ContentHashPort } from '@runs/application/ports/content-hash.port';
import type { HeldHarnessKeys } from '@runs/application/services/held-harness-keys.service';
import type { RunFileSources } from '@runs/application/services/run-file-sources.service';
import { RunLeases } from '@runs/application/services/run-leases.service';
import { Runs } from '@runs/application/services/runs.service';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import { RunEnded } from '@runs/domain/events/run-ended.event';
import { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@runs/domain/events/run-lease-expired.event';
import { DrizzleRunRepository } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { requestedBySpec, requestedByTask } from './support/runs';
import * as schema from './support/schema';

const CLAIMED_AT = new Date('2026-01-02T03:04:05.000Z');
const LEASE_MS = 60_000;
const HOLDER = 'runner_holder';
const OTHER = 'runner_other';

const TIMES = {
  early: CLAIMED_AT.getTime() + 10_000,
  'at expiry': CLAIMED_AT.getTime() + LEASE_MS,
  late: CLAIMED_AT.getTime() + 90_000,
};

type When = keyof typeof TIMES;

type Action =
  | { readonly kind: 'renew'; readonly by: string; readonly when: When }
  | {
      readonly kind: 'complete';
      readonly failed: boolean;
      readonly when: When;
    }
  | { readonly kind: 'time-out'; readonly when: When }
  | {
      readonly kind: 'sweep' | 'stop' | 'cancel';
      readonly when: When;
    };

type Requester = 'spec' | 'task';

const when = fc.constantFrom<When>('early', 'at expiry', 'late');

const action: fc.Arbitrary<Action> = fc.oneof(
  fc.record({
    kind: fc.constant('renew' as const),
    by: fc.constantFrom(HOLDER, OTHER),
    when,
  }),
  fc.record({
    kind: fc.constant('complete' as const),
    failed: fc.boolean(),
    when,
  }),
  fc.record({ kind: fc.constant('time-out' as const), when }),
  fc.record({
    kind: fc.constantFrom('sweep' as const, 'stop' as const, 'cancel' as const),
    when,
  }),
);

const actions = fc.array(action, { minLength: 2, maxLength: 5 });

const requester = fc.constantFrom<Requester>('spec', 'task');

let database: TestDatabase;
let context: DrizzleContext;
let runs: DrizzleRunRepository;
const committed: DomainEvent[] = [];

beforeAll(async () => {
  database = await openDatabase('run_lease_races');
  context = new DrizzleContext(database.db);
  runs = new DrizzleRunRepository(context, {
    dispatch: async (events) =>
      context.afterCommit(() => committed.push(...events)),
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const clockAt = (at: number): ClockPort => ({
  now: () => new Date(at),
  sleep: async () => {},
});

const claimants: RunnerClaimantsPort = {
  claimantOf: async () => ({
    workspaceId: null as never,
    harnesses: [],
    offer: null as never,
    claims: 'nothing',
  }),
};

const claimedRun = async (by: Requester): Promise<string> => {
  const id = randomUUID();

  await database.db.insert(schema.run).values({
    id,
    workspaceId: `ws_${id}`,
    harness: 'dev',
    state: 'claimed',
    claimedBy: HOLDER,
    leaseExpiresAt: new Date(CLAIMED_AT.getTime() + LEASE_MS),
    placement: [],
    ...(by === 'task' ? requestedByTask(id) : requestedBySpec(id)),
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    },
  });

  return id;
};

const handover = { next: 'review', note: 'Which queue?' };

const performed = async (runId: string, each: Action): Promise<void> => {
  const clock = clockAt(TIMES[each.when]);
  const service = new Runs(
    runs,
    {} as ContentHashPort,
    clock,
    {} as HeldHarnessKeys,
  );
  const completing = new CompleteRunHandler(
    runs,
    context,
    clock,
    {} as RunFileSources,
  );

  switch (each.kind) {
    case 'renew':
      return new RenewLeaseHandler(runs, claimants, clock).execute(
        new RenewLeaseCommand(runId, each.by),
      );
    case 'complete':
      return completing.execute(
        new CompleteRunCommand(
          runId,
          HOLDER,
          each.failed ? 1 : 0,
          each.failed,
          undefined,
          handover,
          'session_1',
        ),
      );
    case 'time-out':
      return completing.execute(
        new CompleteRunCommand(
          runId,
          HOLDER,
          124,
          true,
          undefined,
          null,
          null,
          false,
          false,
          true,
        ),
      );
    case 'sweep':
      await new RunLeases(runs).expireLeases(clock.now());
      return;
    case 'stop':
      await service.requestStop(RunId.of(runId));
      return;
    case 'cancel':
      await service.cancel(RunId.of(runId), 'cancelled by a person');
      return;
  }
};

const refused = (error: unknown): boolean =>
  error instanceof TranslatedDomainError || error instanceof DomainError;

interface Raced {
  readonly run: Run;
  readonly events: readonly DomainEvent[];
  readonly succeeded: readonly Action[];
}

const about = (event: DomainEvent, runId: string): boolean =>
  'runId' in event &&
  event.runId instanceof RunId &&
  event.runId.value === runId;

const raced = async (by: Requester, all: readonly Action[]): Promise<Raced> => {
  const runId = await claimedRun(by);
  const settled = await Promise.allSettled(
    all.map((each) => performed(runId, each)),
  );

  for (const each of settled) {
    if (each.status === 'rejected' && !refused(each.reason)) {
      throw each.reason;
    }
  }

  const run = await runs.findById(RunId.of(runId));

  if (!run) {
    throw new Error(`Run ${runId} is gone after the race.`);
  }

  return {
    run,
    events: committed.filter((event) => about(event, runId)),
    succeeded: all.filter((_, at) => settled[at].status === 'fulfilled'),
  };
};

const ENDINGS = [RunEnded, RunCancelled, RunExhausted];

const RUNS = { numRuns: 60 };

const race = (holds: (result: Raced) => boolean) =>
  fc.asyncProperty(requester, actions, async (by, all) =>
    holds(await raced(by, all)),
  );

const reported = (succeeded: readonly Action[]): boolean =>
  succeeded.some(
    (each) => each.kind === 'complete' || each.kind === 'time-out',
  );

describe('a claimed run raced by its runner, the lease sweeper and a person', () => {
  it('holds a lease exactly while it is claimed', async () => {
    await fc.assert(
      race(
        ({ run }) =>
          (run.leaseExpiresAt !== null) === (run.state === 'claimed'),
      ),
      RUNS,
    );
  }, 120_000);

  it('commits its end once, and only when it has ended', async () => {
    await fc.assert(
      race(
        ({ run, events }) =>
          events.filter((event) =>
            ENDINGS.some((type) => event instanceof type),
          ).length === (run.hasEnded ? 1 : 0),
      ),
      RUNS,
    );
  }, 120_000);

  it('loses each attempt to the sweeper at most once', async () => {
    await fc.assert(
      race(({ events }) => {
        const lost = events.flatMap((event) =>
          event instanceof RunLeaseExpired ? [event.attempt.number] : [],
        );

        return new Set(lost).size === lost.length;
      }),
      RUNS,
    );
  }, 120_000);

  it('is no longer held by its runner once the runner reports it done', async () => {
    await fc.assert(
      race(
        ({ run, succeeded }) => !reported(succeeded) || run.state !== 'claimed',
      ),
      RUNS,
    );
  }, 120_000);

  it('never goes back on the queue after a person stops it', async () => {
    await fc.assert(
      race(
        ({ run, succeeded }) =>
          !succeeded.some((each) => each.kind === 'stop') ||
          run.state !== 'queued',
      ),
      RUNS,
    );
  }, 120_000);

  it('lets only the runner that holds the claim renew it', async () => {
    await fc.assert(
      race(({ succeeded }) =>
        succeeded.every((each) => each.kind !== 'renew' || each.by === HOLDER),
      ),
      RUNS,
    );
  }, 120_000);
});
