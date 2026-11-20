import {
  type PlannedCheck,
  StackCheck,
} from '@change-review/domain/aggregates/stack-check.aggregate';
import { LeasedStackCheckDeleted } from '@change-review/domain/events/leased-stack-check-deleted.event';
import { StackCheckLayersFailed } from '@change-review/domain/events/stack-check-layers-failed.event';
import { StackCheckReservationDropped } from '@change-review/domain/events/stack-check-reservation-dropped.event';
import { StackChecked } from '@change-review/domain/events/stack-checked.event';
import { InvalidStackCheckError } from '@change-review/domain/exceptions/invalid-stack-check.error';
import { StackCheckNotLeasedError } from '@change-review/domain/exceptions/stack-check-not-leased.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { WAITING_LIMIT_MS } from '@change-review/domain/value-objects/runner-assignment.vo';
import {
  MAX_ATTEMPTS,
  MAX_LEASE_MS,
  RunnerClaim,
} from '@change-review/domain/value-objects/runner-claim.vo';
import {
  type CheckedStep,
  type StepId,
  skipOf,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { LayerId } from '@change-review/domain/value-objects/stack-ids';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const START = new Date('2026-11-20T09:00:00.000Z');
const RUNNERS = ['runner_a', 'runner_b'] as const;
const POOL = PoolId.of('pool_burst');
const ANY = RunnerOffer.none();
const LAYERS = [LayerId.of('c1.l1'), LayerId.of('c1.l2')];

const STEP_IDS: readonly StepId[] = [WHOLE_STEP, ...LAYERS];

const PLANNED: PlannedCheck = {
  steps: STEP_IDS.map((id) => ({
    id,
    hunks: [],
    stopsOnFailure: false,
    runsSetup: false,
  })),
  layers: LAYERS,
};

const FAILURES = {
  retrying: ProvisionFailure.of('http-error', 'answered 503'),
  final: ProvisionFailure.of('not-allowed', 'the pool refused'),
};

const SKIP = skipOf('checkout-failed', 'git said no');

type Runner = (typeof RUNNERS)[number];

type RunnerAction =
  | 'reserve'
  | 'claim'
  | 'renew'
  | 'unclaim'
  | 'unreserve'
  | 'skip';

type Finding = 'passed' | 'layer-failed' | 'whole-failed';

type Mark =
  | 'lease-end'
  | 'longest-lease'
  | 'reservation-end'
  | 'wait-limit'
  | 'next-provision';

type OtherAction = 'expire-wait' | 'redraft' | 'retain' | 'recheck' | 'delete';

type Step =
  | { readonly kind: 'wait'; readonly ms: number }
  | { readonly kind: 'until'; readonly mark: Mark; readonly offset: number }
  | { readonly kind: RunnerAction; readonly runner: Runner }
  | {
      readonly kind: 'report';
      readonly runner: Runner;
      readonly finding: Finding;
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
    weight: 4,
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
    weight: 3,
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
  { weight: 3, arbitrary: byRunner('reserve') },
  { weight: 5, arbitrary: byRunner('claim') },
  { weight: 3, arbitrary: byRunner('renew') },
  { weight: 1, arbitrary: byRunner('unclaim') },
  { weight: 1, arbitrary: byRunner('unreserve') },
  { weight: 1, arbitrary: byRunner('skip') },
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('report' as const),
      runner,
      finding: fc.oneof(
        { weight: 2, arbitrary: fc.constant<Finding>('passed') },
        { weight: 3, arbitrary: fc.constant<Finding>('layer-failed') },
        { weight: 1, arbitrary: fc.constant<Finding>('whole-failed') },
      ),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('provision-failed' as const),
      runner,
      failure: fc.oneof(
        { weight: 3, arbitrary: fc.constant('retrying' as const) },
        { weight: 2, arbitrary: fc.constant('final' as const) },
      ),
    }),
  },
  { weight: 1, arbitrary: bare('expire-wait') },
  { weight: 3, arbitrary: bare('redraft') },
  { weight: 2, arbitrary: bare('retain') },
  { weight: 3, arbitrary: bare('recheck') },
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

const trial = fc.oneof(
  { weight: 3, arbitrary: fc.constant(true) },
  { weight: 1, arbitrary: fc.constant(false) },
);

const checked = (id: StepId, passed: boolean): CheckedStep => ({
  step: id,
  passed,
  output: passed ? '' : 'error',
  durationMs: 1_000,
});

const FOUND: Readonly<Record<Finding, readonly CheckedStep[]>> = {
  passed: [
    checked(WHOLE_STEP, true),
    checked(LAYERS[0], true),
    checked(LAYERS[1], true),
  ],
  'layer-failed': [
    checked(WHOLE_STEP, true),
    checked(LAYERS[0], false),
    checked(LAYERS[1], true),
  ],
  'whole-failed': [checked(WHOLE_STEP, false)],
};

const waiting = (isTrial: boolean): StackCheck => {
  const check = StackCheck.begin({
    stackId: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    teamId: TeamId.of('team_1'),
    trial: isTrial,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null),
    entries: [],
    now: START,
  });

  check.pullEvents();

  return check;
};

const markOf = (check: StackCheck, mark: Mark): number | null => {
  switch (mark) {
    case 'lease-end':
      return check.claim.leaseExpiresAt?.getTime() ?? null;
    case 'longest-lease':
      return check.claim.claimedAt
        ? check.claim.claimedAt.getTime() + MAX_LEASE_MS
        : null;
    case 'reservation-end':
      return check.reservation?.until.getTime() ?? null;
    case 'wait-limit':
      return check.waitingSince.getTime() + WAITING_LIMIT_MS;
    case 'next-provision':
      return check.provisioning.nextAttemptAt?.getTime() ?? null;
  }
};

const movedTo = (check: StackCheck, now: Date, each: Step): Date => {
  if (each.kind === 'wait') {
    return new Date(now.getTime() + each.ms);
  }
  if (each.kind !== 'until') {
    return now;
  }

  const mark = markOf(check, each.mark);

  return mark === null
    ? now
    : new Date(Math.max(now.getTime(), mark + each.offset));
};

const actsAsRunner = (each: Acting): each is ByRunner => 'runner' in each;

const appliedBy = (check: StackCheck, each: ByRunner, now: Date) => {
  const by = RunnerId.of(each.runner);

  switch (each.kind) {
    case 'reserve':
      return check.reservedFor(by, POOL, now);
    case 'claim':
      return check.claimedFor(by, ANY, now);
    case 'renew':
      return check.renewedFor(by, now);
    case 'unclaim':
      return check.unclaimedBy(by, now);
    case 'unreserve':
      return check.unreservedFor(by);
    case 'skip':
      return check.skip(by, SKIP, now);
    case 'report':
      return check.recordResult(by, PLANNED, FOUND[each.finding], now);
    case 'provision-failed':
      return check.provisionFailed(by, FAILURES[each.failure], now);
  }
};

const applied = (check: StackCheck, each: Acting, now: Date): StackCheck => {
  if (actsAsRunner(each)) {
    return appliedBy(check, each, now);
  }

  switch (each.kind) {
    case 'expire-wait':
      return check.expireWait(now);
    case 'redraft':
      return check.redrafted(check.entries, now);
    case 'retain':
      return check.retainCheckedLayers(now);
    case 'recheck':
      return check.rechecking(now);
    case 'delete':
      return check.delete(now);
  }
};

const refused = (error: unknown): boolean =>
  error instanceof InvalidStackCheckError ||
  error instanceof StackCheckNotLeasedError;

const countOf = (
  events: readonly DomainEvent[],
  type: abstract new (...args: never[]) => DomainEvent,
): number => events.filter((event) => event instanceof type).length;

interface Visit {
  readonly before: StackCheck;
  readonly after: StackCheck;
  readonly step: Acting;
  readonly accepted: boolean;
  readonly now: Date;
  readonly events: readonly DomainEvent[];
  readonly ends: number;
  readonly redraftRequests: number;
  readonly begun: StackCheck | null;
}

const walk = (isTrial: boolean, all: readonly Step[]): readonly Visit[] => {
  let check = waiting(isTrial);
  let now = START;
  let ends = 0;
  let redraftRequests = 0;
  const visits: Visit[] = [];

  for (const each of all) {
    if (each.kind === 'wait' || each.kind === 'until') {
      now = movedTo(check, now, each);
      continue;
    }

    const before = check;
    let next = check;
    let accepted = true;

    try {
      next = applied(check, each, now);
    } catch (error) {
      if (!refused(error)) {
        throw error;
      }
      accepted = false;
    }

    const begun = accepted && each.kind === 'recheck' ? next : null;
    const after = begun ? before : next;
    const events = after.pullEvents();

    ends += countOf(events, StackChecked);
    redraftRequests += countOf(events, StackCheckLayersFailed);
    visits.push({
      before,
      after,
      step: each,
      accepted,
      now,
      events,
      ends,
      redraftRequests,
      begun,
    });

    if (begun) {
      check = begun;
      ends = 0;
      redraftRequests = 0;
    } else {
      check = after;
    }
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
  fc.property(trial, steps, (isTrial, all) => walk(isTrial, all).every(holds));

const hasEnded = (check: StackCheck): boolean =>
  check.status === 'checked' || check.status === 'skipped';

const changed = ({ before, after, accepted }: Visit): boolean =>
  accepted && before !== after;

const stored = (check: StackCheck): StackCheck =>
  StackCheck.rehydrate({
    id: check.id,
    runId: check.runId,
    taskId: check.taskId,
    teamId: check.teamId,
    trial: check.trial,
    workspaceId: check.workspaceId,
    request: check.request,
    status: check.status,
    entries: check.entries,
    redraftCount: check.redraftCount,
    outcome: check.outcome,
    claim: RunnerClaim.rehydrate({
      claimedBy: check.claim.claimedBy,
      attempts: check.claim.attempts,
      leaseExpiresAt: check.claim.leaseExpiresAt,
      claimedAt: check.claim.claimedAt,
    }),
    waitingSince: check.waitingSince,
    reservation: check.reservation,
    provisioning: Provisioning.rehydrate(
      check.provisioning.attempts,
      check.provisioning.nextAttemptAt,
    ),
    version: check.version,
  });

const readsBackAlike = (check: StackCheck, now: Date): boolean => {
  const back = stored(check);

  return (
    back.status === check.status &&
    back.statusAt(now) === check.statusAt(now) &&
    back.claimableAt(now) === check.claimableAt(now) &&
    back.provisionableAt(now) === check.provisionableAt(now) &&
    back.recheckable === check.recheckable &&
    RUNNERS.every(
      (each) =>
        back.beingCheckedBy(RunnerId.of(each), now) ===
        check.beingCheckedBy(RunnerId.of(each), now),
    )
  );
};

const claimable = (check: StackCheck, by: Runner, now: Date): boolean =>
  check.status === 'waiting' &&
  now.getTime() - check.waitingSince.getTime() <= WAITING_LIMIT_MS &&
  !leaseRuns(check.claim, now) &&
  check.claim.attempts < MAX_ATTEMPTS &&
  (check.reservation === null ||
    !check.reservation.isActiveAt(now) ||
    check.reservation.isFor(RunnerId.of(by)));

const sameEnd = (before: StackCheck, after: StackCheck): boolean =>
  after.status === before.status &&
  after.outcome?.checkedAt.getTime() === before.outcome?.checkedAt.getTime() &&
  after.outcome?.whole?.passed === before.outcome?.whole?.passed &&
  after.outcome?.skip?.code === before.outcome?.skip?.code &&
  after.waitingSince.getTime() === before.waitingSince.getTime();

const leaseMovedBack = (before: StackCheck, after: StackCheck): boolean =>
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
    (event) => event instanceof StackCheckReservationDropped,
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

const RUNNER_REPORTS: readonly Acting['kind'][] = ['report', 'skip'];

const HOLDER_ACTIONS: readonly Acting['kind'][] = [
  'renew',
  'unclaim',
  ...RUNNER_REPORTS,
];

describe(
  'a change stack check under any order of runner, provisioner, sweeper and stack actions',
  { timeout: 60_000 },
  () => {
    it('holds a lease only while it waits to be checked, with its runner and the time it was claimed', () => {
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

    it('holds no runner and no reservation once it is no longer waiting', () => {
      fc.assert(
        lifecycle(
          ({ after }) =>
            after.status === 'waiting' || !after.assignment.holdsRunner,
        ),
        RUNS,
      );
    });

    it('lets only the runner that holds the lease renew it, report on it or give it up', () => {
      fc.assert(
        lifecycle(
          ({ before, step: each, accepted, now }) =>
            !actsAsRunner(each) ||
            !HOLDER_ACTIONS.includes(each.kind) ||
            !accepted ||
            heldBy(before.claim, each.runner, now),
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

    it('takes what its runner found while the lease runs', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted, now }) =>
            !actsAsRunner(each) ||
            !RUNNER_REPORTS.includes(each.kind) ||
            !heldBy(before.claim, each.runner, now) ||
            (accepted && after.status !== 'waiting'),
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

    it('stays checked or skipped once it ends, whatever comes after', () => {
      fc.assert(
        lifecycle(
          ({ before, after }) => !hasEnded(before) || sameEnd(before, after),
        ),
        RUNS,
      );
    });

    it('records its end once, and only when it ends', () => {
      fc.assert(
        lifecycle(
          ({ after, ends }) =>
            ends === (hasEnded(after) ? 1 : 0) &&
            (!hasEnded(after) || after.outcome !== null),
        ),
        RUNS,
      );
    });

    it('asks for its layers to be redrafted at most once, and never as a recheck', () => {
      fc.assert(
        lifecycle(
          ({ after, redraftRequests }) =>
            redraftRequests <= 1 &&
            after.redraftCount <= 1 &&
            (!after.recheck ||
              (redraftRequests === 0 && after.status !== 'redrafting')),
        ),
        RUNS,
      );
    });

    it('is skipped for waiting too long only once the wait has run out and no lease runs', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, accepted, now }) =>
            each.kind !== 'expire-wait' ||
            !accepted ||
            (before.status === 'waiting' &&
              now.getTime() - before.waitingSince.getTime() >
                WAITING_LIMIT_MS &&
              !leaseRuns(before.claim, now) &&
              after.status === 'skipped'),
        ),
        RUNS,
      );
    });

    it('drops each reservation with a notice to its runner, unless that runner claims it', () => {
      fc.assert(lifecycle(reservationDropsAnnounced), RUNS);
    });

    it('lets its runner go when it is deleted while the runner holds the lease', () => {
      fc.assert(
        lifecycle(
          ({ before, after, step: each, now, events }) =>
            countOf(events, LeasedStackCheckDeleted) ===
              (each.kind === 'delete' && leaseRuns(before.claim, now)
                ? 1
                : 0) &&
            (each.kind !== 'delete' ||
              (!leaseRuns(after.claim, now) && after.reservation === null)),
        ),
        RUNS,
      );
    });

    it('rechecks only a trial’s first check that found something, from scratch', () => {
      fc.assert(
        lifecycle(({ before, step: each, accepted, begun, now }) => {
          if (each.kind !== 'recheck') {
            return begun === null;
          }

          const due = before.trial && !before.recheck && before.hasWholeResult;

          return (
            accepted === due &&
            (begun === null ||
              (begun.recheck &&
                begun.status === 'waiting' &&
                begun.outcome === null &&
                begun.redraftCount === 0 &&
                begun.claim.attempts === 0 &&
                !begun.assignment.holdsRunner &&
                begun.provisioning.attempts === 0 &&
                begun.waitingSince.getTime() === now.getTime() &&
                begun.claimableAt(now)))
          );
        }),
        RUNS,
      );
    });

    it('waits for a runner again, from scratch, once its layers are redrafted', () => {
      fc.assert(
        lifecycle(
          (visit) =>
            visit.step.kind !== 'redraft' ||
            !changed(visit) ||
            (visit.after.status === 'waiting' &&
              visit.after.outcome === null &&
              visit.after.redraftCount === visit.before.redraftCount + 1 &&
              visit.after.waitingSince.getTime() === visit.now.getTime() &&
              !visit.after.assignment.holdsRunner &&
              visit.after.provisioning.attempts === 0),
        ),
        RUNS,
      );
    });

    it.fails('lets a runner claim it again once its layers are redrafted', () => {
      fc.assert(
        lifecycle(
          (visit) =>
            visit.step.kind !== 'redraft' ||
            !changed(visit) ||
            visit.after.claim.attempts === 0,
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
