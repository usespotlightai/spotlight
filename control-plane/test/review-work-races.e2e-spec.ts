import { randomUUID } from 'node:crypto';

import { FailPushDiffCommand } from '@change-review/application/commands/fail-push-diff.command';
import { FailPushDiffHandler } from '@change-review/application/commands/handlers/fail-push-diff.handler';
import { RecordChangeStackCheckHandler } from '@change-review/application/commands/handlers/record-change-stack-check.handler';
import { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import type { WorkPort } from '@change-review/application/ports/work.port';
import { ClaimReviewWork } from '@change-review/application/services/claim-review-work.service';
import { ExpireWaitingReviewWork } from '@change-review/application/services/expire-waiting-review-work.service';
import type { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import { ReviewWorkAccess } from '@change-review/application/services/review-work-access.service';
import { StackPushes } from '@change-review/application/services/stack-pushes.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { PushDiffLeaseReleased } from '@change-review/domain/events/push-diff-lease-released.event';
import { StackChecked } from '@change-review/domain/events/stack-checked.event';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import { DrizzleChangeStackReader } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.reader';
import { DrizzleChangeStackRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import { DrizzlePushDiffRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/push-diff.repository';
import { DrizzleStackCheckRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import { pushDiff } from '@change-review/infrastructure/persistence/drizzle/schemas/push-diff.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import { RenewReviewWorkLeaseHandler } from '@runs/application/commands/handlers/renew-review-work-lease.handler';
import { RenewReviewWorkLeaseCommand } from '@runs/application/commands/runner.commands';
import type {
  ClaimedReviewWork,
  ReviewWorkLeaseRenewal,
} from '@runs/application/ports/review-work.port';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const NOW = new Date('2026-01-02T03:04:05.000Z');
const LEASE_MS = 10 * 60_000;
const WAITED_MS = 50 * 60_000;
const HOLDER = RunnerId.of('runner_holder');
const OTHER = RunnerId.of('runner_other');
const OUTSIDER = RunnerId.of('runner_outsider');
const ANY = RunnerOffer.none();
const POOL = PoolId.of('pool_burst');

const TIMES = {
  early: NOW.getTime() + 10_000,
  'at expiry': NOW.getTime() + LEASE_MS,
  late: NOW.getTime() + LEASE_MS + 60_000,
};

type When = keyof typeof TIMES;

const RUNS = { numRuns: 60 };

const HEADS = ['b', 'c', 'd'];

let database: TestDatabase;
let context: DrizzleContext;
let checks: DrizzleStackCheckRepository;
let stacks: DrizzleChangeStackRepository;
let diffs: DrizzlePushDiffRepository;
let claims: ClaimReviewWork;
let access: ReviewWorkAccess;
const committed: DomainEvent[] = [];
const logged: unknown[] = [];

beforeAll(async () => {
  database = await openDatabase('review_work_races');
  context = new DrizzleContext(database.db);

  const dispatcher = {
    dispatch: async (events: readonly DomainEvent[]) =>
      context.afterCommit(() => committed.push(...events)),
  };

  checks = new DrizzleStackCheckRepository(context, dispatcher);
  diffs = new DrizzlePushDiffRepository(context, dispatcher);
  stacks = new DrizzleChangeStackRepository(context, dispatcher);
  claims = new ClaimReviewWork(
    checks,
    stacks,
    { patchOf: () => '' },
    context,
    diffs,
  );
  access = new ReviewWorkAccess(
    checks,
    new DrizzleChangeStackReader(context),
    diffs,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const clockAt = (at: number): ClockPort => ({
  now: () => new Date(at),
  sleep: async () => {},
});

const recordingLogger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: (fields) => logged.push(fields),
};

const claimants: RunnerClaimantsPort = {
  claimantOf: async () => ({
    workspaceId: null as never,
    harnesses: [],
    offer: null as never,
    claims: 'nothing',
  }),
};

const sha = (digit: string): CommitSha => {
  const parsed = CommitSha.parsed(digit.repeat(40));

  if (!parsed) {
    throw new Error(`${digit} makes no commit sha.`);
  }

  return parsed;
};

const refused = (error: unknown): boolean =>
  error instanceof TranslatedDomainError || error instanceof DomainError;

const settledAll = async <T>(
  all: readonly Promise<T>[],
): Promise<readonly PromiseSettledResult<T>[]> => {
  const settled = await Promise.allSettled(all);

  for (const each of settled) {
    if (each.status === 'rejected' && !refused(each.reason)) {
      throw each.reason;
    }
  }

  return settled;
};

const DIFF = Diff.of([
  {
    path: 'api.ts',
    previousPath: null,
    status: 'modified',
    binary: false,
    hunks: [
      {
        id: HunkId.at(1),
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        patch: '@@ -1 +1 @@\n-before\n+after',
      },
    ],
  },
]);

const readyStack = (workspaceId: WorkspaceId, since: Date): ChangeStack =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of(randomUUID()),
    origin: StackOrigin.run(RunId.of(randomUUID())),
    taskId: null,
    teamOfRun: TeamId.of('team_checked'),
    trial: false,
    checkouts: 1,
    workspaceId,
    repository: null,
    base: null,
    diff: DIFF,
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: CheckRequest.of('npm test', null),
    now: since,
  }).propose(
    [
      {
        kind: 'change',
        title: 'Api',
        intent: 'Api',
        layers: [
          {
            title: 'Api 1',
            summary: 'Api 1',
            dependsOn: [],
            hunks: [{ hunk: HunkId.of('h1') }],
            notes: [{ path: 'api.ts', note: 'Why it changes' }],
            questions: [],
          },
        ],
      },
    ],
    since,
  );

const waitingCheck = async (
  workspaceId: WorkspaceId,
  since: Date,
): Promise<StackCheck> => {
  const stack = readyStack(workspaceId, since);
  const check = StackCheck.beginFor(stack, since);

  if (!check) {
    throw new Error('A ready stack begins no check.');
  }

  await stacks.add(stack);
  await checks.add(check);

  return check;
};

const waitingDiff = async (
  workspaceId: WorkspaceId,
  taskId: TaskId,
  input: {
    readonly since: Date;
    readonly placement?: RunnerPlacement;
    readonly head?: string;
  },
): Promise<PushDiff> => {
  const diff = PushDiff.record({
    id: PushDiffId.of(randomUUID()),
    workspaceId,
    taskId,
    pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
    push: {
      head: sha(input.head ?? 'b'),
      baseTip: sha('a'),
      pushedBy: Pusher.of('octocat'),
      pushedAt: input.since,
    },
    placement: input.placement ?? RunnerPlacement.anywhere(),
    now: input.since,
  });
  await diffs.add(diff);

  return diff;
};

const storedCheck = async (id: StackCheckId): Promise<StackCheck> => {
  const check = await checks.find(id);

  if (!check) {
    throw new Error(`Check ${id.toString()} is gone after the race.`);
  }

  return check;
};

const storedDiff = async (id: PushDiffId): Promise<PushDiff> => {
  const diff = await diffs.find(id);

  if (!diff) {
    throw new Error(`Diff ${id.value} is gone after the race.`);
  }

  return diff;
};

const clearedReviewWork = async (): Promise<void> => {
  await database.db.delete(schema.stackCheck);
  await database.db.delete(pushDiff);
};

describe('runners claiming review work at the same moment', () => {
  interface Queue {
    readonly diffs: number;
    readonly checks: number;
    readonly leased: 'nothing' | 'a diff' | 'a check';
    readonly reserved: 'nothing' | 'a diff' | 'a check';
    readonly runners: number;
  }

  const queue: fc.Arbitrary<Queue> = fc.record({
    diffs: fc.integer({ min: 0, max: 3 }),
    checks: fc.integer({ min: 0, max: 3 }),
    leased: fc.constantFrom('nothing', 'a diff', 'a check'),
    reserved: fc.constantFrom('nothing', 'a diff', 'a check'),
    runners: fc.integer({ min: 2, max: 5 }),
  });

  interface Handed {
    readonly runner: RunnerId;
    readonly work: ClaimedReviewWork;
  }

  interface Raced {
    readonly input: Queue;
    readonly free: ReadonlySet<string>;
    readonly handed: readonly Handed[];
    readonly storedChecks: readonly StackCheck[];
    readonly storedDiffs: readonly PushDiff[];
    readonly leasedTo: readonly (readonly [Handed, boolean, boolean])[];
  }

  const idOf = (work: ClaimedReviewWork): string =>
    work.kind === 'diff' ? work.diffId.value : work.checkId.value;

  const taken = async (
    input: Queue,
    workspaceId: WorkspaceId,
  ): Promise<{
    readonly checks: readonly StackCheck[];
    readonly diffs: readonly PushDiff[];
    readonly free: ReadonlySet<string>;
  }> => {
    const taskId = TaskId.of(randomUUID());
    const begunChecks: StackCheck[] = [];
    const begunDiffs: PushDiff[] = [];

    for (let each = 0; each < input.checks; each++) {
      begunChecks.push(await waitingCheck(workspaceId, NOW));
    }
    for (let each = 0; each < input.diffs; each++) {
      begunDiffs.push(
        await waitingDiff(workspaceId, taskId, {
          since: NOW,
          head: HEADS[each],
        }),
      );
    }

    const [leasedCheck, reservedCheck] =
      input.leased === 'a check'
        ? [begunChecks[0], begunChecks[1]]
        : [undefined, begunChecks[0]];
    const [leasedDiff, reservedDiff] =
      input.leased === 'a diff'
        ? [begunDiffs[0], begunDiffs[1]]
        : [undefined, begunDiffs[0]];
    const held = new Set<string>();

    if (leasedCheck) {
      await checks.save(leasedCheck.claimedFor(OUTSIDER, ANY, NOW));
      held.add(leasedCheck.stackId.value);
    }
    if (leasedDiff) {
      await diffs.save(leasedDiff.claimedFor(OUTSIDER, ANY, NOW));
      held.add(leasedDiff.id.value);
    }
    if (input.reserved === 'a check' && reservedCheck) {
      await checks.save(reservedCheck.reservedFor(OUTSIDER, POOL, NOW));
      held.add(reservedCheck.stackId.value);
    }
    if (input.reserved === 'a diff' && reservedDiff) {
      await diffs.save(reservedDiff.reservedFor(OUTSIDER, POOL, NOW));
      held.add(reservedDiff.id.value);
    }

    return {
      checks: begunChecks,
      diffs: begunDiffs,
      free: new Set(
        [
          ...begunChecks.map((each) => each.stackId.value),
          ...begunDiffs.map((each) => each.id.value),
        ].filter((id) => !held.has(id)),
      ),
    };
  };

  const leasedWorkOf = (work: ClaimedReviewWork) =>
    work.kind === 'diff'
      ? { kind: 'diff' as const, id: work.diffId.value }
      : { kind: 'check' as const, id: work.checkId.value };

  const raced = async (input: Queue): Promise<Raced> => {
    const workspaceId = WorkspaceId.of(`ws_${randomUUID()}`);
    const setUp = await taken(input, workspaceId);
    const runners = Array.from({ length: input.runners }, () =>
      RunnerId.of(`runner_${randomUUID()}`),
    );
    const results = await Promise.all(
      runners.map((runner) => claims.claimNext(workspaceId, runner, ANY, NOW)),
    );
    const handed = results.flatMap((work, at) =>
      work ? [{ runner: runners[at], work }] : [],
    );

    return {
      input,
      free: setUp.free,
      handed,
      storedChecks: await Promise.all(
        setUp.checks.map((each) => storedCheck(each.id)),
      ),
      storedDiffs: await Promise.all(
        setUp.diffs.map((each) => storedDiff(each.id)),
      ),
      leasedTo: await Promise.all(
        handed.map(async (each) => {
          const work = leasedWorkOf(each.work);

          return [
            each,
            (await access.leasedWork(work, each.runner, NOW)) !== null,
            (await access.leasedWork(work, OUTSIDER, NOW)) !== null,
          ] as const;
        }),
      ),
    };
  };

  const race = (holds: (result: Raced) => boolean) =>
    fc.asyncProperty(queue, async (input) => holds(await raced(input)));

  const holderOf = (result: Raced, id: string): RunnerId | null =>
    result.storedChecks.find((each) => each.stackId.value === id)?.claim
      .claimedBy ??
    result.storedDiffs.find((each) => each.id.value === id)?.claim.claimedBy ??
    null;

  it('hands each piece of work to one runner at most', async () => {
    await fc.assert(
      race(({ handed }) => {
        const ids = handed.map((each) => idOf(each.work));

        return new Set(ids).size === ids.length;
      }),
      RUNS,
    );
  }, 120_000);

  it('stores the lease of the runner it handed the work to', async () => {
    await fc.assert(
      race((result) =>
        result.handed.every(
          (each) =>
            holderOf(result, idOf(each.work))?.equals(each.runner) ?? false,
        ),
      ),
      RUNS,
    );
  }, 120_000);

  it('never hands out work another runner leases or is reserved for', async () => {
    await fc.assert(
      race(({ handed, free }) =>
        handed.every((each) => free.has(idOf(each.work))),
      ),
      RUNS,
    );
  }, 120_000);

  it('hands out every free piece of work while runners are left', async () => {
    await fc.assert(
      race(
        ({ handed, free, input }) =>
          handed.length === Math.min(free.size, input.runners),
      ),
      RUNS,
    );
  }, 120_000);

  it('lets the runner it handed the work to reach it, and no other', async () => {
    await fc.assert(
      race(({ leasedTo }) =>
        leasedTo.every(([, byHolder, byOutsider]) => byHolder && !byOutsider),
      ),
      RUNS,
    );
  }, 120_000);
});

type LeaseAction =
  | { readonly kind: 'renew'; readonly by: RunnerId; readonly when: When }
  | { readonly kind: 'report'; readonly by: RunnerId; readonly when: When }
  | { readonly kind: 'fail'; readonly by: RunnerId; readonly when: When }
  | {
      readonly kind: 'claim';
      readonly when: When;
      readonly followedBy: FollowUp | 'nothing';
    }
  | { readonly kind: 'unclaim'; readonly when: When }
  | { readonly kind: 'sweep'; readonly when: When }
  | { readonly kind: 'supersede'; readonly when: When };

type FollowUp = 'renew' | 'report' | 'fail';

const when = fc.constantFrom<When>('early', 'at expiry', 'late');

const by = fc.oneof(
  { weight: 3, arbitrary: fc.constant(HOLDER) },
  { weight: 1, arbitrary: fc.constant(OTHER) },
);

const byRunner = (kind: FollowUp): fc.Arbitrary<LeaseAction> =>
  fc.record({ kind: fc.constant(kind), by, when });

const bare = (
  kind: 'unclaim' | 'sweep' | 'supersede',
): fc.Arbitrary<LeaseAction> => fc.record({ kind: fc.constant(kind), when });

const claim = (...followUps: readonly FollowUp[]): fc.Arbitrary<LeaseAction> =>
  fc.record({
    kind: fc.constant('claim' as const),
    when,
    followedBy: fc.constantFrom<FollowUp | 'nothing'>('nothing', ...followUps),
  });

interface Outcome {
  readonly action: LeaseAction;
  readonly result: PromiseSettledResult<unknown>;
}

const fulfilled = (outcomes: readonly Outcome[]) =>
  outcomes.filter((each) => each.result.status === 'fulfilled');

const claimedByOther = (outcomes: readonly Outcome[]): readonly Outcome[] =>
  fulfilled(outcomes).filter(
    (each) =>
      each.action.kind === 'claim' &&
      each.result.status === 'fulfilled' &&
      each.result.value !== null,
  );

const renewed = (outcomes: readonly Outcome[], runner: RunnerId) =>
  fulfilled(outcomes).filter(
    (each) =>
      each.action.kind === 'renew' &&
      each.action.by.equals(runner) &&
      each.result.status === 'fulfilled' &&
      each.result.value === 'renewed',
  );

const renewalsHeld = (outcomes: readonly Outcome[]): boolean =>
  renewed(outcomes, HOLDER).every((each) => each.action.when === 'early') &&
  (renewed(outcomes, OTHER).length === 0 ||
    claimedByOther(outcomes).length > 0);

const HANDED_BACK: readonly LeaseAction['kind'][] = ['unclaim', 'fail'];

const handedBack = (outcomes: readonly Outcome[]): boolean =>
  fulfilled(outcomes).some((each) => HANDED_BACK.includes(each.action.kind)) ||
  claimedByOther(outcomes).some(
    (each) => each.action.kind === 'claim' && each.action.followedBy === 'fail',
  );

const claimsWaited = (outcomes: readonly Outcome[]): boolean =>
  claimedByOther(outcomes).every(
    (each) =>
      each.action.when === 'at expiry' ||
      (each.action.when === 'early' && handedBack(outcomes)),
  );

const renewing = (
  work: RenewReviewWorkLeaseCommand['work'],
  each: { readonly by: RunnerId; readonly when: When },
): Promise<ReviewWorkLeaseRenewal> =>
  new RenewReviewWorkLeaseHandler(
    claims,
    claimants,
    clockAt(TIMES[each.when]),
  ).execute(new RenewReviewWorkLeaseCommand(work, each.by.value));

const swept = (at: When): Promise<void> =>
  new ExpireWaitingReviewWork(
    checks,
    diffs,
    clockAt(TIMES[at]),
    recordingLogger,
  ).processDue();

const tookOver = async (
  each: Extract<LeaseAction, { readonly kind: 'claim' }>,
  followUp: (next: LeaseAction) => Promise<unknown>,
): Promise<ClaimedReviewWork | null> => {
  const claimed = await claims.claimNext(
    WORKSPACE,
    OTHER,
    ANY,
    new Date(TIMES[each.when]),
  );

  if (claimed && each.followedBy !== 'nothing') {
    await followUp({ kind: each.followedBy, by: OTHER, when: each.when }).catch(
      (error: unknown) => {
        if (!refused(error)) {
          throw error;
        }
      },
    );
  }

  return claimed;
};

const WORKSPACE = WorkspaceId.of('ws_leased');

describe('a leased check raced by its runner, another runner and the sweeper', () => {
  const action: fc.Arbitrary<LeaseAction> = fc.oneof(
    { weight: 2, arbitrary: byRunner('renew') },
    { weight: 2, arbitrary: byRunner('report') },
    { weight: 3, arbitrary: claim('renew', 'report') },
    { weight: 1, arbitrary: bare('unclaim') },
    { weight: 2, arbitrary: bare('sweep') },
  );

  const actions = fc.array(action, { minLength: 2, maxLength: 5 });

  const SKIPPED = 'checkout-failed';

  interface Raced {
    readonly check: StackCheck;
    readonly outcomes: readonly Outcome[];
    readonly events: readonly DomainEvent[];
    readonly errors: readonly unknown[];
  }

  const performed = (
    check: StackCheck,
    each: LeaseAction,
  ): Promise<unknown> => {
    const stackId = check.stackId.value;
    const clock = clockAt(TIMES[each.when]);

    switch (each.kind) {
      case 'renew':
        return renewing({ kind: 'check', stackId, recheck: false }, each);
      case 'report':
      case 'fail':
        return new RecordChangeStackCheckHandler(checks, stacks, clock).execute(
          new RecordChangeStackCheckCommand(
            each.by.value,
            stackId,
            false,
            { code: SKIPPED, detail: null },
            [],
          ),
        );
      case 'claim':
        return tookOver(each, (followUp) => performed(check, followUp));
      case 'unclaim':
        return claims.unclaim(
          { kind: 'check', id: ReviewWorkId.of(stackId), recheck: false },
          HOLDER,
          clock.now(),
        );
      case 'sweep':
      case 'supersede':
        return swept(each.when);
    }
  };

  const raced = async (all: readonly LeaseAction[]): Promise<Raced> => {
    await clearedReviewWork();
    committed.length = 0;
    logged.length = 0;

    const waiting = await waitingCheck(
      WORKSPACE,
      new Date(NOW.getTime() - WAITED_MS),
    );
    await checks.save(waiting.claimedFor(HOLDER, ANY, NOW));
    committed.length = 0;

    const settled = await settledAll(
      all.map((each) => performed(waiting, each)),
    );

    return {
      check: await storedCheck(waiting.id),
      outcomes: all.map((each, at) => ({ action: each, result: settled[at] })),
      events: [...committed],
      errors: [...logged],
    };
  };

  const race = (holds: (result: Raced) => boolean) =>
    fc.asyncProperty(actions, async (all) => holds(await raced(all)));

  const hasEnded = (check: StackCheck): boolean =>
    check.status === 'checked' || check.status === 'skipped';

  it('commits its end once, and only when it has ended', async () => {
    await fc.assert(
      race(
        ({ check, events }) =>
          events.filter((event) => event instanceof StackChecked).length ===
          (hasEnded(check) ? 1 : 0),
      ),
      RUNS,
    );
  }, 120_000);

  it('keeps what a runner reported once the runner is told it was taken', async () => {
    await fc.assert(
      race(
        ({ check, outcomes }) =>
          !fulfilled(outcomes).some((each) => each.action.kind === 'report') ||
          check.outcome?.skip?.code === SKIPPED,
      ),
      RUNS,
    );
  }, 120_000);

  it('takes a report only from the runner whose lease runs', async () => {
    await fc.assert(
      race(({ outcomes }) =>
        fulfilled(outcomes).every(
          (each) =>
            each.action.kind !== 'report' ||
            (each.action.when === 'early' && each.action.by.equals(HOLDER)) ||
            (each.action.by.equals(OTHER) &&
              claimedByOther(outcomes).length > 0),
        ),
      ),
      RUNS,
    );
  }, 120_000);

  it('hands the check to another runner only once the lease has run out and before the wait has', async () => {
    await fc.assert(
      race(({ outcomes }) => claimsWaited(outcomes)),
      RUNS,
    );
  }, 120_000);

  it('renews only the lease of the runner that holds it', async () => {
    await fc.assert(
      race(({ outcomes }) => renewalsHeld(outcomes)),
      RUNS,
    );
  }, 120_000);

  it('holds a runner only while it waits, and the sweeper meets no error', async () => {
    await fc.assert(
      race(
        ({ check, errors }) =>
          errors.length === 0 &&
          (check.status === 'waiting' || !check.assignment.holdsRunner),
      ),
      RUNS,
    );
  }, 120_000);
});

describe('a leased push diff raced by its runner, another runner, the sweeper and a newer push', () => {
  const action: fc.Arbitrary<LeaseAction> = fc.oneof(
    { weight: 2, arbitrary: byRunner('renew') },
    { weight: 2, arbitrary: byRunner('report') },
    { weight: 2, arbitrary: byRunner('fail') },
    { weight: 3, arbitrary: claim('renew', 'report', 'fail') },
    { weight: 1, arbitrary: bare('unclaim') },
    { weight: 2, arbitrary: bare('sweep') },
    { weight: 2, arbitrary: bare('supersede') },
  );

  const actions = fc.array(action, { minLength: 2, maxLength: 5 });

  const pushes = (at: When): StackPushes =>
    new StackPushes(
      diffs,
      stacks,
      { ...({} as WorkPort), task: async () => null },
      {} as GenerateChangeStack,
      { stackingFor: async (_, work) => work() },
      { generate: () => randomUUID() },
      clockAt(TIMES[at]),
    );

  interface Raced {
    readonly diff: PushDiff;
    readonly outcomes: readonly Outcome[];
    readonly events: readonly DomainEvent[];
    readonly errors: readonly unknown[];
  }

  const performed = (
    diff: PushDiff,
    newer: PushDiff,
    each: LeaseAction,
  ): Promise<unknown> => {
    const diffId = diff.id.value;

    switch (each.kind) {
      case 'renew':
        return renewing({ kind: 'diff', diffId }, each);
      case 'report':
        return pushes(each.when).diffed(diffId, each.by, {
          diff: '',
          base: 'a'.repeat(40),
        });
      case 'fail':
        return new FailPushDiffHandler(pushes(each.when)).execute(
          new FailPushDiffCommand(diffId, each.by.value, 'the stacks changed'),
        );
      case 'claim':
        return tookOver(each, (followUp) => performed(diff, newer, followUp));
      case 'unclaim':
        return claims.unclaim(
          { kind: 'diff', id: ReviewWorkId.of(diffId) },
          HOLDER,
          new Date(TIMES[each.when]),
        );
      case 'sweep':
        return swept(each.when);
      case 'supersede':
        return pushes(each.when).supersedeEarlier(newer.id);
    }
  };

  const raced = async (all: readonly LeaseAction[]): Promise<Raced> => {
    await clearedReviewWork();
    logged.length = 0;

    const taskId = TaskId.of(randomUUID());
    const since = new Date(NOW.getTime() - WAITED_MS);
    const waiting = await waitingDiff(WORKSPACE, taskId, { since });
    const newer = await waitingDiff(WORKSPACE, taskId, {
      since: new Date(since.getTime() + 1_000),
      placement: RunnerPlacement.of(['nobody']),
      head: 'c',
    });
    await diffs.save(waiting.claimedFor(HOLDER, ANY, NOW));
    committed.length = 0;

    const settled = await settledAll(
      all.map((each) => performed(waiting, newer, each)),
    );

    return {
      diff: await storedDiff(waiting.id),
      outcomes: all.map((each, at) => ({ action: each, result: settled[at] })),
      events: committed.filter(
        (event) =>
          event instanceof PushDiffLeaseReleased &&
          event.diffId.equals(waiting.id),
      ),
      errors: [...logged],
    };
  };

  const race = (holds: (result: Raced) => boolean) =>
    fc.asyncProperty(actions, async (all) => holds(await raced(all)));

  it('lets each runner go at most once for each lease it was given', async () => {
    await fc.assert(
      race(
        ({ events, outcomes }) =>
          events.length <= 1 + claimedByOther(outcomes).length,
      ),
      RUNS,
    );
  }, 120_000);

  it('is settled once a runner is told its diff was taken', async () => {
    await fc.assert(
      race(
        ({ diff, outcomes }) =>
          !fulfilled(outcomes).some((each) => each.action.kind === 'report') ||
          diff.settled,
      ),
      RUNS,
    );
  }, 120_000);

  it('is superseded only once no lease runs', async () => {
    await fc.assert(
      race(
        ({ diff, outcomes }) =>
          diff.status !== 'superseded' ||
          outcomes.some(
            (each) =>
              each.action.kind === 'supersede' &&
              (each.action.when !== 'early' || handedBack(outcomes)),
          ),
      ),
      RUNS,
    );
  }, 120_000);

  it('hands the diff to another runner only once the lease has run out and before the wait has', async () => {
    await fc.assert(
      race(({ outcomes }) => claimsWaited(outcomes)),
      RUNS,
    );
  }, 120_000);

  it('renews only the lease of the runner that holds it', async () => {
    await fc.assert(
      race(({ outcomes }) => renewalsHeld(outcomes)),
      RUNS,
    );
  }, 120_000);

  it('holds a runner only while it waits, and the sweeper meets no error', async () => {
    await fc.assert(
      race(
        ({ diff, errors }) =>
          errors.length === 0 &&
          (!diff.settled || !diff.assignment.holdsRunner),
      ),
      RUNS,
    );
  }, 120_000);
});

describe('the workspaces with review work that waits for a runner', () => {
  it('names each workspace once, and leaves out work that is reserved or backs off until a later time', async () => {
    await clearedReviewWork();

    const waitingOnly = WorkspaceId.of(`waiting-${randomUUID()}`);
    const reservedOnly = WorkspaceId.of(`reserved-${randomUUID()}`);
    const backingOff = WorkspaceId.of(`backing-off-${randomUUID()}`);
    const checked = WorkspaceId.of(`checked-${randomUUID()}`);
    const task = () => TaskId.of(randomUUID());

    await waitingDiff(waitingOnly, task(), { since: NOW });
    await waitingDiff(waitingOnly, task(), { since: NOW, head: 'c' });
    const reserved = await waitingDiff(reservedOnly, task(), { since: NOW });
    await diffs.save(reserved.reservedFor(OUTSIDER, POOL, NOW));
    const failing = await waitingDiff(backingOff, task(), { since: NOW });
    const reservedFailing = failing.reservedFor(OUTSIDER, POOL, NOW);
    await diffs.save(reservedFailing);
    await diffs.save(
      (await storedDiff(failing.id)).provisionFailed(
        OUTSIDER,
        ProvisionFailure.of('unreachable', 'The provisioner answered nothing'),
        NOW,
      ),
    );
    await waitingCheck(checked, NOW);

    const values = (ids: readonly WorkspaceId[]) =>
      ids.map((each) => each.value).sort();

    expect(values(await diffs.workspacesWaiting(NOW))).toEqual([
      waitingOnly.value,
    ]);
    expect(
      values(
        await diffs.workspacesWaiting(new Date(NOW.getTime() + 86_400_000)),
      ),
    ).toEqual([backingOff.value, waitingOnly.value].sort());
    expect(values(await checks.workspacesWaiting(NOW))).toEqual([
      checked.value,
    ]);

    await clearedReviewWork();
  });
});
