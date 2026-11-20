import {
  PushDiff,
  type PushSettlement,
} from '@change-review/domain/aggregates/push-diff.aggregate';
import { PushDiffLeaseReleased } from '@change-review/domain/events/push-diff-lease-released.event';
import { PushDiffReservationDropped } from '@change-review/domain/events/push-diff-reservation-dropped.event';
import { PushDiffNotLeasedError } from '@change-review/domain/exceptions/push-diff-not-leased.error';
import { PushDiffStateConflictError } from '@change-review/domain/exceptions/push-diff-state-conflict.error';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { WAITING_LIMIT_MS } from '@change-review/domain/value-objects/runner-assignment.vo';
import {
  MAX_ATTEMPTS,
  MAX_LEASE_MS,
  RunnerClaim,
} from '@change-review/domain/value-objects/runner-claim.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const START = new Date('2026-11-20T09:00:00.000Z');
const RUNNERS = ['runner_a', 'runner_b'] as const;
const POOL = PoolId.of('pool_burst');
const ANY = RunnerOffer.none();

const FAILURES = {
  retrying: ProvisionFailure.of('http-error', 'answered 503'),
  final: ProvisionFailure.of('not-allowed', 'the pool refused'),
};

const SETTLEMENTS: readonly PushSettlement[] = [
  'stacked',
  'shown',
  'superseded',
  'task-gone',
  { refused: 'the base moved' },
];

type Runner = (typeof RUNNERS)[number];

type RunnerAction =
  | 'reserve'
  | 'claim'
  | 'renew'
  | 'unclaim'
  | 'unreserve'
  | 'fail';

type Mark =
  | 'lease-end'
  | 'longest-lease'
  | 'reservation-end'
  | 'wait-limit'
  | 'next-provision';

type OtherAction = 'expire-wait' | 'supersede' | 'delete';

type Step =
  | { readonly kind: 'wait'; readonly ms: number }
  | { readonly kind: 'until'; readonly mark: Mark; readonly offset: number }
  | { readonly kind: RunnerAction; readonly runner: Runner }
  | {
      readonly kind: 'settle';
      readonly runner: Runner;
      readonly settlement: PushSettlement;
    }
  | {
      readonly kind: 'provision-failed';
      readonly runner: Runner;
      readonly failure: keyof typeof FAILURES;
    }
  | { readonly kind: OtherAction };

type Acting = Exclude<Step, { readonly kind: 'wait' | 'until' }>;

type ByRunner = Extract<Acting, { readonly runner: Runner }>;

const runner = fc.constantFrom(...RUNNERS);

const byRunner = (kind: RunnerAction): fc.Arbitrary<Step> =>
  runner.map((each) => ({ kind, runner: each }));

const bare = (kind: OtherAction): fc.Arbitrary<Step> => fc.constant({ kind });

const step: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant('wait' as const),
      ms: fc.oneof(
        { weight: 3, arbitrary: fc.integer({ min: 0, max: 60_000 }) },
        { weight: 2, arbitrary: fc.integer({ min: 60_000, max: 720_000 }) },
        {
          weight: 1,
          arbitrary: fc.integer({ min: 720_000, max: 4_200_000 }),
        },
      ),
    }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant('until' as const),
      mark: fc.oneof(
        { weight: 3, arbitrary: fc.constant<Mark>('lease-end') },
        {
          weight: 1,
          arbitrary: fc.constantFrom<Mark>(
            'longest-lease',
            'reservation-end',
            'wait-limit',
            'next-provision',
          ),
        },
      ),
      offset: fc.constantFrom(-1, 0, 1),
    }),
  },
  { weight: 6, arbitrary: byRunner('reserve') },
  { weight: 10, arbitrary: byRunner('claim') },
  { weight: 6, arbitrary: byRunner('renew') },
  { weight: 2, arbitrary: byRunner('unclaim') },
  { weight: 2, arbitrary: byRunner('unreserve') },
  { weight: 8, arbitrary: byRunner('fail') },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('settle' as const),
      runner,
      settlement: fc.constantFrom(...SETTLEMENTS),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('provision-failed' as const),
      runner,
      failure: fc.oneof(
        { weight: 3, arbitrary: fc.constant('retrying' as const) },
        { weight: 2, arbitrary: fc.constant('final' as const) },
      ),
    }),
  },
  { weight: 2, arbitrary: bare('expire-wait') },
  { weight: 1, arbitrary: bare('supersede') },
);

const held: fc.Arbitrary<readonly Step[]> = fc
  .record({ by: runner, renewals: fc.integer({ min: 1, max: 8 }) })
  .map(({ by, renewals }) =>
    Array.from({ length: renewals }, (): readonly Step[] => [
      { kind: 'until', mark: 'lease-end', offset: -1 },
      { kind: 'renew', runner: by },
    ]).flat(),
  );

const chunk: fc.Arbitrary<readonly Step[]> = fc.oneof(
  { weight: 12, arbitrary: step.map((each): readonly Step[] => [each]) },
  { weight: 1, arbitrary: held },
);

const steps: fc.Arbitrary<readonly Step[]> = fc
  .tuple(
    fc.array(chunk, { minLength: 20, maxLength: 60, size: 'max' }),
    fc.option(bare('delete'), { freq: 4 }),
  )
  .map(([each, last]) => [...each.flat(), ...(last ? [last] : [])]);

const sha = (digit: string): CommitSha => {
  const parsed = CommitSha.parsed(digit.repeat(40));

  if (!parsed) {
    throw new Error(`${digit} makes no commit sha.`);
  }

  return parsed;
};

const recorded = (): PushDiff => {
  const diff = PushDiff.record({
    id: PushDiffId.of('diff_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
    push: {
      head: sha('b'),
      baseTip: sha('a'),
      pushedBy: Pusher.of('octocat'),
      pushedAt: START,
    },
    placement: RunnerPlacement.anywhere(),
    now: START,
  });

  diff.pullEvents();

  return diff;
};

const markOf = (diff: PushDiff, mark: Mark): number | null => {
  switch (mark) {
    case 'lease-end':
      return diff.claim.leaseExpiresAt?.getTime() ?? null;
    case 'longest-lease':
      return diff.claim.claimedAt
        ? diff.claim.claimedAt.getTime() + MAX_LEASE_MS
        : null;
    case 'reservation-end':
      return diff.reservation?.until.getTime() ?? null;
    case 'wait-limit':
      return diff.recordedAt.getTime() + WAITING_LIMIT_MS;
    case 'next-provision':
      return diff.provisioning.nextAttemptAt?.getTime() ?? null;
  }
};

const movedTo = (diff: PushDiff, now: Date, each: Step): Date => {
  if (each.kind === 'wait') {
    return new Date(now.getTime() + each.ms);
  }
  if (each.kind !== 'until') {
    return now;
  }

  const mark = markOf(diff, each.mark);

  return mark === null
    ? now
    : new Date(Math.max(now.getTime(), mark + each.offset));
};

const actsAsRunner = (each: Acting): each is ByRunner => 'runner' in each;

const appliedBy = (diff: PushDiff, each: ByRunner, now: Date): PushDiff => {
  const by = RunnerId.of(each.runner);

  switch (each.kind) {
    case 'reserve':
      return diff.reservedFor(by, POOL, now);
    case 'claim':
      return diff.claimedFor(by, ANY, now);
    case 'renew':
      return diff.renewedFor(by, now);
    case 'unclaim':
      return diff.unclaimedBy(by, now);
    case 'unreserve':
      return diff.unreservedFor(by);
    case 'fail':
      return diff.failedFor(by, 'the stacks changed', now);
    case 'settle':
      return diff.settledBy(by, each.settlement, now);
    case 'provision-failed':
      return diff.provisionFailed(by, FAILURES[each.failure], now);
  }
};

const applied = (diff: PushDiff, each: Acting, now: Date): PushDiff => {
  if (actsAsRunner(each)) {
    return appliedBy(diff, each, now);
  }

  switch (each.kind) {
    case 'expire-wait':
      return diff.expireWait(now);
    case 'supersede':
      return diff.supersededAt(now);
    case 'delete':
      return diff.delete(now);
  }
};

const refused = (error: unknown): boolean =>
  error instanceof PushDiffStateConflictError ||
  error instanceof PushDiffNotLeasedError;

interface Visit {
  readonly before: PushDiff;
  readonly after: PushDiff;
  readonly step: Acting;
  readonly accepted: boolean;
  readonly now: Date;
  readonly events: readonly DomainEvent[];
}

const walk = (all: readonly Step[]): readonly Visit[] => {
  let diff = recorded();
  let now = START;
  const visits: Visit[] = [];

  for (const each of all) {
    if (each.kind === 'wait' || each.kind === 'until') {
      now = movedTo(diff, now, each);
      continue;
    }

    const before = diff;
    let accepted = true;

    try {
      diff = applied(diff, each, now);
    } catch (error) {
      if (!refused(error)) {
        throw error;
      }
      accepted = false;
    }

    visits.push({
      before,
      after: diff,
      step: each,
      accepted,
      now,
      events: diff.pullEvents(),
    });
  }

  return visits;
};

const leaseRuns = (claim: RunnerClaim, now: Date): boolean =>
  claim.leaseExpiresAt !== null &&
  claim.claimedAt !== null &&
  now.getTime() < claim.leaseExpiresAt.getTime() &&
  now.getTime() - claim.claimedAt.getTime() < MAX_LEASE_MS;

const heldBy = (claim: RunnerClaim, by: Runner, now: Date): boolean =>
  leaseRuns(claim, now) && claim.claimedBy?.value === by;

const RUNS = { numRuns: 1_000 };

const lifecycle = (holds: (visit: Visit) => boolean) =>
  fc.property(steps, (all) => walk(all).every(holds));

const changed = ({ before, after, accepted }: Visit): boolean =>
  accepted && before !== after;

const stored = (diff: PushDiff): PushDiff =>
  PushDiff.rehydrate({
    id: diff.id,
    workspaceId: diff.workspaceId,
    taskId: diff.taskId,
    pullRequest: diff.pullRequest,
    repository: diff.repository,
    push: diff.push,
    placement: diff.placement,
    status: diff.status,
    failure: diff.failure,
    claim: RunnerClaim.rehydrate({
      claimedBy: diff.claim.claimedBy,
      attempts: diff.claim.attempts,
      leaseExpiresAt: diff.claim.leaseExpiresAt,
      claimedAt: diff.claim.claimedAt,
    }),
    reservation: diff.reservation,
    provisioning: Provisioning.rehydrate(
      diff.provisioning.attempts,
      diff.provisioning.nextAttemptAt,
    ),
    recordedAt: diff.recordedAt,
    version: diff.version,
  });

const readsBackAlike = (diff: PushDiff, now: Date): boolean => {
  const back = stored(diff);

  return (
    back.status === diff.status &&
    back.failure === diff.failure &&
    back.claimableAt(now) === diff.claimableAt(now) &&
    back.provisionableAt(now) === diff.provisionableAt(now) &&
    back.waitExpiredAt(now) === diff.waitExpiredAt(now) &&
    RUNNERS.every(
      (each) =>
        back.beingDiffedBy(RunnerId.of(each), now) ===
        diff.beingDiffedBy(RunnerId.of(each), now),
    )
  );
};

const claimable = (diff: PushDiff, by: Runner, now: Date): boolean =>
  diff.status === 'waiting' &&
  now.getTime() - diff.recordedAt.getTime() <= WAITING_LIMIT_MS &&
  !leaseRuns(diff.claim, now) &&
  diff.claim.attempts < MAX_ATTEMPTS &&
  (diff.reservation === null ||
    !diff.reservation.isActiveAt(now) ||
    diff.reservation.isFor(RunnerId.of(by)));

const leaseMovedBack = (before: PushDiff, after: PushDiff): boolean =>
  before.claim.claimedBy !== null &&
  after.claim.claimedBy !== null &&
  before.claim.claimedBy.equals(after.claim.claimedBy) &&
  before.claim.claimedAt?.getTime() === after.claim.claimedAt?.getTime() &&
  (after.claim.leaseExpiresAt?.getTime() ?? 0) <
    (before.claim.leaseExpiresAt?.getTime() ?? 0);

const reservationDropsAnnounced = ({
  before,
  after,
  step: each,
  accepted,
  events,
}: Visit): boolean => {
  const drops = events.filter(
    (event) => event instanceof PushDiffReservationDropped,
  );
  const { reservation } = before;
  const claimedByItsRunner =
    accepted &&
    each.kind === 'claim' &&
    reservation?.isFor(RunnerId.of(each.runner)) === true;

  return (
    drops.length <= 1 &&
    drops.every(
      (drop) => reservation?.isFor(drop.runner) && after.reservation === null,
    ) &&
    (reservation === null ||
      after.reservation !== null ||
      drops.length === 1 ||
      claimedByItsRunner)
  );
};

const RUNNER_REPORTS: readonly Acting['kind'][] = ['settle', 'fail'];

const HOLDER_ACTIONS: readonly Acting['kind'][] = [
  'renew',
  'unclaim',
  ...RUNNER_REPORTS,
];

describe(
  'a push diff under any order of runner, provisioner, sweeper and newer pushes',
  { timeout: 60_000 },
  () => {
    it('holds a lease only while it waits to be diffed, with its runner and the time it was claimed', () => {
      fc.assert(
        lifecycle(({ after: { claim, status } }) => {
          const held = claim.claimedBy !== null;

          return (
            held === (claim.leaseExpiresAt !== null) &&
            held === (claim.claimedAt !== null) &&
            (!held || status === 'waiting')
          );
        }),
        RUNS,
      );
    });

    it('holds no runner and no reservation once it is settled', () => {
      fc.assert(
        lifecycle(
          ({ after }) => !after.settled || !after.assignment.holdsRunner,
        ),
        RUNS,
      );
    });

    it('gives a reason exactly when it failed', () => {
      fc.assert(
        lifecycle(
          ({ after }) =>
            (after.status === 'failed') === (after.failure !== null),
        ),
        RUNS,
      );
    });

    it('lets only the runner that holds the lease renew it, report on it or give it up', () => {
      fc.assert(
        lifecycle(
          (visit) =>
            !actsAsRunner(visit.step) ||
            !HOLDER_ACTIONS.includes(visit.step.kind) ||
            !changed(visit) ||
            heldBy(visit.before.claim, visit.step.runner, visit.now),
        ),
        RUNS,
      );
    });

    it('takes a late report about a settled diff without changing it', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted }) =>
            !RUNNER_REPORTS.includes(each.kind) ||
            !before.settled ||
            (accepted && after === before),
        ),
        RUNS,
      );
    });

    it('hands its lease to a runner exactly when it is free, not used up, not reserved for another and not waited out', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted, now }) =>
            each.kind !== 'claim' ||
            (accepted === claimable(before, each.runner, now) &&
              (!accepted ||
                (heldBy(after.claim, each.runner, now) &&
                  after.claim.attempts === before.claim.attempts + 1 &&
                  after.reservation === null))),
        ),
        RUNS,
      );
    });

    it('keeps the lease of a runner that renews it in time', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted, now }) =>
            each.kind !== 'renew' ||
            !heldBy(before.claim, each.runner, now) ||
            (accepted &&
              heldBy(after.claim, each.runner, now) &&
              (after.claim.leaseExpiresAt?.getTime() ?? 0) > now.getTime()),
        ),
        RUNS,
      );
    });

    it('settles with what its runner made while the lease runs', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted, now }) =>
            each.kind !== 'settle' ||
            !heldBy(before.claim, each.runner, now) ||
            (accepted && after.settled),
        ),
        RUNS,
      );
    });

    it('fails for good only when its runner fails on the last attempt, and otherwise waits for a runner again', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted, now }) =>
            each.kind !== 'fail' ||
            !heldBy(before.claim, each.runner, now) ||
            (accepted &&
              after.claim.claimedBy === null &&
              (after.status === 'failed') ===
                before.claim.attempts >= MAX_ATTEMPTS &&
              (after.status === 'failed' || after.status === 'waiting')),
        ),
        RUNS,
      );
    });

    it('never moves a lease back while the same runner holds the same claim', () => {
      fc.assert(
        lifecycle(({ before, after }) => !leaseMovedBack(before, after)),
        RUNS,
      );
    });

    it('never leases past the longest lease from when it was claimed', () => {
      fc.assert(
        lifecycle(
          ({ after: { claim } }) =>
            claim.claimedAt === null ||
            !claim.isLeasedAt(
              new Date(claim.claimedAt.getTime() + MAX_LEASE_MS),
            ),
        ),
        RUNS,
      );
    });

    it('stays settled once it settles, whatever comes after', () => {
      fc.assert(
        lifecycle(
          ({ before, after }) =>
            !before.settled ||
            (after.status === before.status &&
              after.failure === before.failure),
        ),
        RUNS,
      );
    });

    it('is superseded by a newer push exactly when it waits and no lease runs', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted, now }) =>
            each.kind !== 'supersede' ||
            (accepted &&
              (before.status === 'waiting' && !leaseRuns(before.claim, now)
                ? after.status === 'superseded' && !after.assignment.holdsRunner
                : after === before)),
        ),
        RUNS,
      );
    });

    it('fails for waiting too long only once no lease runs and the wait or the attempts have run out', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted, now }) =>
            each.kind !== 'expire-wait' ||
            !accepted ||
            (before.status === 'waiting' &&
              !leaseRuns(before.claim, now) &&
              (before.claim.attempts >= MAX_ATTEMPTS ||
                now.getTime() - before.recordedAt.getTime() >
                  WAITING_LIMIT_MS) &&
              after.status === 'failed'),
        ),
        RUNS,
      );
    });

    it('drops each reservation with a notice to its runner, unless that runner claims it', () => {
      fc.assert(lifecycle(reservationDropsAnnounced), RUNS);
    });

    it('lets its runner go exactly when it takes back a running lease the runner did not hand back', () => {
      fc.assert(
        lifecycle(
          (visit) =>
            visit.events.filter(
              (event) => event instanceof PushDiffLeaseReleased,
            ).length ===
            (changed(visit) &&
            visit.step.kind !== 'unclaim' &&
            leaseRuns(visit.before.claim, visit.now) &&
            visit.after.claim.claimedBy === null
              ? 1
              : 0),
        ),
        RUNS,
      );
    });

    it('comes back from storage as it was saved', () => {
      fc.assert(
        lifecycle(({ after, now }) => readsBackAlike(after, now)),
        RUNS,
      );
    });
  },
);
