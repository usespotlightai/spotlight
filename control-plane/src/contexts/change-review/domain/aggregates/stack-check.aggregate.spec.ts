import { checkReasonOf } from '@change-review/application/rendering/check-reason';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import { HeldCheckForgotten } from '@change-review/domain/events/held-check-forgotten.event';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { StackCheckNotHeldError } from '@change-review/domain/exceptions/stack-check-not-held.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  CheckClaim,
  MOST_CHECK_ATTEMPTS,
  MOST_HOLD_MS,
} from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type {
  CheckedStep,
  StepId,
} from '@change-review/domain/value-objects/stack-check.vo';
import {
  keptSkipOf,
  skipOf,
  unprovisioned,
  WAITING_LIMIT_MS,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const stepOf = (raw: string): StepId =>
  raw === WHOLE_STEP ? WHOLE_STEP : LayerId.of(raw);

const changed = (path: string, at: number): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.at(at + 1),
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      patch: '@@ -1 +1 @@\n-before\n+after',
    },
  ],
});

const DIFF = Diff.of(
  ['schema.ts', 'api.ts', 'form.tsx', 'package-lock.json', 'docs.md'].map(
    changed,
  ),
);

const NOW = new Date('2026-09-16T10:00:00Z');

const LATER = new Date(NOW.getTime() + 60_000);

const RUNNER = RunnerId.of('runner_1');

const OTHER = RunnerId.of('runner_2');

const ANY = RunnerTerms.none();

const RESERVED_UNTIL = new Date(LATER.getTime() + 5 * 60_000);

const REFUSED = ProvisionFailure.of('refused', 'answered 503');

const OVERDUE = new Date(LATER.getTime() + WAITING_LIMIT_MS + 1);

const cohort = (
  title: string,
  layers: string[][],
  kind: ProposedCohort['kind'] = 'change',
): ProposedCohort => ({
  kind,
  title,
  intent: title,
  layers: layers.map((hunks, at) => ({
    title: `${title} ${at + 1}`,
    summary: `${title} ${at + 1}`,
    dependsOn: [],
    ranges: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
    notes: hunks.map((hunk) => ({
      path: DIFF.fileOf(hunk)?.path ?? hunk,
      note: 'Why it changes',
    })),
  })),
});

const stack = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    replay: false,
    isSearch: false,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    base: null,
    diff: DIFF,
    facts: StackFacts.none(),
    request: CheckRequest.of('npx tsc --noEmit', null),
    now: NOW,
  }).propose(
    [
      cohort('Invitations', [['h1'], ['h2', 'h3']]),
      cohort('Docs', [['h5']]),
      cohort('Lockfile', [['h4']], 'incidental'),
    ],
    LATER,
  );

const waiting = () => {
  const ready = stack();
  const check = StackCheck.begin({
    stackId: ready.id,
    runId: ready.runId,
    taskId: null,
    replay: false,
    workspaceId: ready.workspaceId,
    request: CheckRequest.of('npx tsc --noEmit', null),
    entries: ready.entries(),
    now: LATER,
  });

  check.pullEvents();
  return check;
};

const checking = () => {
  const check = waiting().claimedFor(RUNNER, ANY, LATER);

  check.pullEvents();
  return check;
};

const planned = () => {
  const ready = stack();
  return { steps: ready.checkSteps(ready.entries()), layers: ready.layers() };
};

const step = (id: string, passes: boolean, output = ''): CheckedStep => ({
  step: stepOf(id),
  passed: passes,
  output,
  tookMs: 1200,
});

const kinds = (check: StackCheck) =>
  check.pullEvents().map((event) => event.kind);

const rehydrated = (over: Record<string, unknown>) =>
  StackCheck.rehydrate({
    stackId: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    replay: false,
    workspaceId: WorkspaceId.of('workspace-1'),
    request: CheckRequest.of('npx tsc --noEmit', null),
    phase: 'waiting',
    entries: [],
    rounds: 0,
    outcome: null,
    claim: CheckClaim.none(),
    waitingSince: LATER,
    reservation: null,
    provisioning: Provisioning.none(),
    version: 0,
    ...over,
  });

const failedAgain = (check: StackCheck, failure = REFUSED) => {
  const due = check.provisioning.nextAt ?? LATER;

  return check
    .reservedFor(RUNNER, PoolId.of('pool_burst'), due)
    .provisionFailed(RUNNER, failure, due);
};

describe('StackCheck', () => {
  it('waits for a runner once the stack settles, and gives up after a while', () => {
    const check = waiting();

    expect(check.stateAt(LATER)).toBe('waiting');
    expect(
      check.stateAt(new Date(LATER.getTime() + WAITING_LIMIT_MS + 1)),
    ).toBe('skipped');
  });

  it('refuses a check command that is not one short line', () => {
    expect(() => CheckRequest.of('npx tsc\nrm -rf /', null)).toThrow(
      InvalidChangeStackError,
    );
  });

  it('keeps what each layer’s check found', () => {
    const checked = checking().recorded(
      RUNNER,
      planned(),
      [
        step(WHOLE_STEP, true),
        step('c1.l1', true),
        step('c1.l2', false, 'error TS2304'),
        step('c2.l1', true),
      ],
      LATER,
    );

    expect(checked.outcome?.state).toBe('checked');
    expect(checked.failedLayers()).toEqual(['c1.l2']);
  });

  it('judges no layer where the finished change itself fails', () => {
    const checked = checking().recorded(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, false, 'error TS2304')],
      LATER,
    );

    expect(checked.outcome).toMatchObject({ state: 'checked', layers: [] });
    expect(
      checkReasonOf({
        skipped: checked.skippedAt(LATER),
        wholeFailed: checked.wholeFailed,
      }),
    ).toBe(
      'The finished change does not pass the check, so its layers were not checked on their own.',
    );
  });

  it('refuses steps the stack does not have, a missing whole, and a second report', () => {
    const check = checking();

    expect(() =>
      check.recorded(RUNNER, planned(), [step('nowhere', true)], LATER),
    ).toThrow(InvalidChangeStackError);
    expect(() =>
      check.recorded(RUNNER, planned(), [step('c1.l1', true)], LATER),
    ).toThrow(InvalidChangeStackError);

    const checked = check.recorded(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true)],
      LATER,
    );

    expect(() =>
      checked.recorded(RUNNER, planned(), [step(WHOLE_STEP, true)], LATER),
    ).toThrow(InvalidChangeStackError);
  });

  it('says why a runner could not check it, in its own words', () => {
    const skipped = checking().skipped(
      RUNNER,
      skipOf('setup-failed', 'npm ci: no network'),
      LATER,
    );

    expect(skipped.stateAt(LATER)).toBe('skipped');
    expect(
      checkReasonOf({
        skipped: skipped.skippedAt(LATER),
        wholeFailed: skipped.wholeFailed,
      }),
    ).toBe(
      'The checkout could not be made ready before the check ran.\n\nnpm ci: no network',
    );
  });

  it('blames nobody in particular where no runner ever took it up', () => {
    const check = waiting();
    const late = new Date(LATER.getTime() + WAITING_LIMIT_MS + 1);

    expect(
      checkReasonOf({
        skipped: check.skippedAt(late),
        wholeFailed: check.wholeFailed,
      }),
    ).toBe('No runner checked the layers in time.');
  });

  it('refuses a reason it does not know', () => {
    expect(() => skipOf('made-up', null)).toThrow(InvalidChangeStackError);
  });

  it('asks for reordering where the whole change builds but a layer does not', () => {
    const checked = checking().recorded(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );

    expect(checked.reordering).toBe(true);
    expect(kinds(checked)).toEqual(['change-stack.layers-failed-check']);
  });

  it('takes the reordered layers and waits to be checked afresh', () => {
    const reordering = checking().recorded(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );
    const again = reordering.reordered(stack().entries(), LATER);

    expect(again.phase).toBe('waiting');
    expect(again.rounds).toBe(1);
    expect(again.outcome).toBeNull();
  });

  it('keeps the checked layers where reordering is given up', () => {
    const reordering = checking().recorded(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );
    reordering.pullEvents();

    const kept = reordering.keptLayers();

    expect(kept.stateAt(LATER)).toBe('checked');
    expect(kinds(kept)).toEqual(['change-stack.checked']);
  });

  it('lets a reservation go when it takes reordered layers', () => {
    const failing = checking().recorded(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );
    const reordering = rehydrated({
      phase: 'reordering',
      outcome: failing.outcome,
      reservation: RunnerReservation.from(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      ),
    });

    const again = reordering.reordered(stack().entries(), LATER);

    expect(again.reservation).toBeNull();
    expect(kinds(again)).toEqual(['change-stack.check-reservation-dropped']);
  });

  it('reorders at most once', () => {
    const failing = (check: StackCheck) =>
      check
        .claimedFor(RUNNER, ANY, LATER)
        .recorded(
          RUNNER,
          planned(),
          [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
          LATER,
        );

    const again = failing(waiting()).reordered(stack().entries(), LATER);

    expect(failing(again).reordering).toBe(false);
  });

  it('refuses to come back in a state it could not have reached', () => {
    expect(() => rehydrated({ phase: 'checked' })).toThrow(
      InconsistentStateError,
    );
    expect(() => rehydrated({ rounds: -1 })).toThrow(InconsistentStateError);
    expect(rehydrated({}).stateAt(LATER)).toBe('waiting');
  });

  describe('claiming it for a runner', () => {
    it('waits to be claimed once the stack settles', () => {
      expect(waiting().claimableAt(LATER)).toBe(true);
    });

    it('holds the claim against a second runner until the lease runs out', () => {
      const held = waiting().claimedFor(RUNNER, ANY, LATER);

      expect(held.claimableAt(LATER)).toBe(false);
      expect(() => held.claimedFor(OTHER, ANY, LATER)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('lets another runner take it up once the lease runs out', () => {
      const held = waiting().claimedFor(RUNNER, ANY, LATER);
      const lapsed = new Date(
        (held.claim.leaseExpiresAt?.getTime() ?? 0) + 1000,
      );

      expect(held.claimableAt(lapsed)).toBe(true);
      expect(held.claimedFor(OTHER, ANY, lapsed).claim.claimedBy).toEqual(
        OTHER,
      );
    });

    it('counts every claim and stops handing it out', () => {
      let check = waiting();
      let at = LATER;

      for (let round = 0; round < MOST_CHECK_ATTEMPTS; round += 1) {
        check = check.claimedFor(RUNNER, ANY, at);
        at = new Date((check.claim.leaseExpiresAt?.getTime() ?? 0) + 1000);
      }

      expect(check.claim.attempts).toBe(MOST_CHECK_ATTEMPTS);
      expect(check.claimableAt(at)).toBe(false);
    });

    it('is not there to claim once nobody checked it in time', () => {
      expect(
        waiting().claimableAt(new Date(LATER.getTime() + WAITING_LIMIT_MS + 1)),
      ).toBe(false);
    });

    it('refuses a runner that does not answer to where it is placed', () => {
      const placed = StackCheck.begin({
        stackId: ChangeStackId.of('stack-1'),
        runId: RunId.of('run-1'),
        taskId: null,
        replay: false,
        workspaceId: WorkspaceId.of('workspace-1'),
        request: CheckRequest.of(
          'npx tsc --noEmit',
          null,
          RunnerPlacement.of(['vpc-internal']),
        ),
        entries: [],
        now: LATER,
      });
      const laptop = RunnerTerms.of(['laptop']);

      expect(placed.claimableBy(RUNNER, laptop, LATER)).toBe(false);
      expect(() => placed.claimedFor(RUNNER, laptop, LATER)).toThrow(
        InvalidChangeStackError,
      );
      expect(
        placed.claimedFor(RUNNER, RunnerTerms.of(['vpc-internal']), LATER).claim
          .claimedBy,
      ).toEqual(RUNNER);
    });

    it('is being checked only by the runner holding its lease', () => {
      const check = checking();
      const lapsed = new Date(
        (check.claim.leaseExpiresAt?.getTime() ?? 0) + 1000,
      );

      expect(check.beingCheckedBy(RUNNER, LATER)).toBe(true);
      expect(check.beingCheckedBy(OTHER, LATER)).toBe(false);
      expect(check.beingCheckedBy(RUNNER, lapsed)).toBe(false);
    });

    it('takes what was found only from the runner holding it', () => {
      const check = checking();

      expect(() =>
        check.recorded(OTHER, planned(), [step(WHOLE_STEP, true)], LATER),
      ).toThrow(StackCheckNotHeldError);
      expect(() =>
        check.skipped(OTHER, skipOf('no-room', null), LATER),
      ).toThrow(StackCheckNotHeldError);
      expect(() =>
        waiting().recorded(RUNNER, planned(), [step(WHOLE_STEP, true)], LATER),
      ).toThrow(StackCheckNotHeldError);
      expect(() =>
        waiting().skipped(RUNNER, skipOf('no-room', null), LATER),
      ).toThrow(StackCheckNotHeldError);
    });

    it('lets the claim go once the check is recorded or skipped', () => {
      const held = waiting().claimedFor(RUNNER, ANY, LATER);

      expect(
        held.recorded(RUNNER, planned(), [step(WHOLE_STEP, true)], LATER).claim
          .claimedBy,
      ).toBeNull();
      expect(
        held.skipped(RUNNER, skipOf('no-room', null), LATER).claim.claimedBy,
      ).toBeNull();
    });
  });

  describe('renewing the lease of the runner checking it', () => {
    const leaseOf = (check: StackCheck) =>
      check.claim.leaseExpiresAt?.getTime() ?? 0;

    it('keeps the runner holding it past the first lease', () => {
      const check = checking();
      const nearlyLapsed = new Date(leaseOf(check) - 1000);
      const renewed = check.renewedFor(RUNNER, nearlyLapsed);
      const pastFirstLease = new Date(leaseOf(check) + 1000);

      expect(leaseOf(renewed)).toBeGreaterThan(leaseOf(check));
      expect(renewed.beingCheckedBy(RUNNER, pastFirstLease)).toBe(true);
      expect(renewed.claimableAt(pastFirstLease)).toBe(false);
      expect(renewed.claim.attempts).toBe(check.claim.attempts);
      expect(renewed.pullEvents()).toEqual([]);
    });

    it('is renewed only by the runner holding it', () => {
      const check = checking();
      const lapsed = new Date(leaseOf(check) + 1000);

      expect(() => check.renewedFor(OTHER, LATER)).toThrow(
        StackCheckNotHeldError,
      );
      expect(() => check.renewedFor(RUNNER, lapsed)).toThrow(
        StackCheckNotHeldError,
      );
      expect(() => waiting().renewedFor(RUNNER, LATER)).toThrow(
        StackCheckNotHeldError,
      );
    });

    it('refuses once the check was recorded or skipped', () => {
      const check = checking();
      const recorded = check.recorded(
        RUNNER,
        planned(),
        [step(WHOLE_STEP, true)],
        LATER,
      );
      const skipped = check.skipped(RUNNER, skipOf('no-room', null), LATER);

      expect(recorded.checkableAt(LATER)).toBe(false);
      expect(skipped.checkableAt(LATER)).toBe(false);
      expect(() => recorded.renewedFor(RUNNER, LATER)).toThrow(
        InvalidChangeStackError,
      );
      expect(() => skipped.renewedFor(RUNNER, LATER)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('keeps being renewed past the hour while its runner holds it', () => {
      const check = waiting().claimedFor(
        RUNNER,
        ANY,
        new Date(OVERDUE.getTime() - 60_000),
      );

      const renewed = check.renewedFor(RUNNER, OVERDUE);
      const pastFirstLease = new Date(leaseOf(check) + 1000);

      expect(check.stateAt(OVERDUE)).toBe('waiting');
      expect(check.checkableAt(OVERDUE)).toBe(true);
      expect(renewed.beingCheckedBy(RUNNER, pastFirstLease)).toBe(true);
      expect(renewed.overdueAt(pastFirstLease)).toBe(false);
      expect(() => renewed.renewedFor(RUNNER, pastFirstLease)).not.toThrow();
    });

    it('still takes what was found past the hour while its runner holds it', () => {
      const check = waiting().claimedFor(
        RUNNER,
        ANY,
        new Date(OVERDUE.getTime() - 60_000),
      );

      const recorded = check.recorded(
        RUNNER,
        planned(),
        [step(WHOLE_STEP, true)],
        OVERDUE,
      );

      expect(recorded.phase).toBe('checked');
      expect(recorded.stateAt(OVERDUE)).toBe('checked');
    });

    it('is skipped as nobody checked once its runner’s lease lapses past the hour', () => {
      const check = waiting().claimedFor(
        RUNNER,
        ANY,
        new Date(OVERDUE.getTime() - 60_000),
      );
      const lapsed = new Date(leaseOf(check));

      expect(check.stateAt(lapsed)).toBe('skipped');
      expect(check.checkableAt(lapsed)).toBe(false);
      expect(check.overdueAt(lapsed)).toBe(true);
      expect(() => check.renewedFor(RUNNER, lapsed)).toThrow(
        InvalidChangeStackError,
      );
      expect(() =>
        check.recorded(RUNNER, planned(), [step(WHOLE_STEP, true)], lapsed),
      ).toThrow(InvalidChangeStackError);
      expect(check.settledOverdue(lapsed).skippedAt(lapsed)).toEqual({
        code: 'nobody-checked',
        detail: null,
      });
    });
  });

  describe('holding it for as long as a check may be held', () => {
    const renewedUntil = (check: StackCheck, until: Date): StackCheck => {
      let renewed = check;
      for (
        let at = LATER.getTime() + 5 * 60_000;
        at < until.getTime();
        at += 5 * 60_000
      ) {
        renewed = renewed.renewedFor(RUNNER, new Date(at));
      }
      return renewed.renewedFor(RUNNER, until);
    };
    const ceiling = new Date(LATER.getTime() + MOST_HOLD_MS);
    const justBefore = new Date(ceiling.getTime() - 1000);

    it('keeps its runner renewing up to the ceiling', () => {
      const renewed = renewedUntil(checking(), justBefore);

      expect(renewed.claim.claimedAt).toEqual(LATER);
      expect(renewed.beingCheckedBy(RUNNER, justBefore)).toBe(true);
      expect(renewed.stateAt(justBefore)).toBe('waiting');
    });

    it('lets go of a runner that keeps renewing past the ceiling and settles it as nobody checked', () => {
      const renewed = renewedUntil(checking(), justBefore);

      expect(renewed.claim.leaseExpiresAt?.getTime()).toBeGreaterThan(
        ceiling.getTime(),
      );
      expect(renewed.beingCheckedBy(RUNNER, ceiling)).toBe(false);
      expect(renewed.stateAt(ceiling)).toBe('skipped');
      expect(renewed.checkableAt(ceiling)).toBe(false);
      expect(() => renewed.renewedFor(RUNNER, ceiling)).toThrow(
        InvalidChangeStackError,
      );
      expect(() =>
        renewed.recorded(RUNNER, planned(), [step(WHOLE_STEP, true)], ceiling),
      ).toThrow(InvalidChangeStackError);
      expect(renewed.overdueAt(ceiling)).toBe(true);
      expect(renewed.settledOverdue(ceiling).skippedAt(ceiling)).toEqual({
        code: 'nobody-checked',
        detail: null,
      });
    });

    it('refuses to renew the claim itself past the ceiling', () => {
      const claim = checking().claim;

      expect(() => claim.renewed(justBefore)).not.toThrow();
      expect(() => claim.renewed(ceiling)).toThrow(InvalidChangeStackError);
    });

    it('refuses a claim kept with no time it was claimed', () => {
      expect(() =>
        CheckClaim.rehydrate({
          claimedBy: RUNNER,
          attempts: 1,
          leaseExpiresAt: ceiling,
          claimedAt: null,
        }),
      ).toThrow();
    });
  });

  describe('being unclaimed when its runner could not take it', () => {
    it('waits to be claimed again at once, the claim not counted', () => {
      const unclaimed = waiting()
        .claimedFor(RUNNER, ANY, LATER)
        .unclaimedBy(RUNNER, LATER);

      expect(unclaimed.claim.claimedBy).toBeNull();
      expect(unclaimed.claim.attempts).toBe(0);
      expect(unclaimed.claimableAt(LATER)).toBe(true);
      expect(unclaimed.pullEvents()).toEqual([]);
    });

    it('is unclaimed only by the runner holding it', () => {
      const held = waiting().claimedFor(RUNNER, ANY, LATER);

      expect(() => held.unclaimedBy(OTHER, LATER)).toThrow(
        StackCheckNotHeldError,
      );
      expect(() => waiting().unclaimedBy(RUNNER, LATER)).toThrow(
        StackCheckNotHeldError,
      );
    });
  });

  describe('keeping why it was skipped', () => {
    it('takes back a skip no runner could have reported', () => {
      expect(keptSkipOf('unprovisioned', '5 attempts')).toEqual({
        code: 'unprovisioned',
        detail: '5 attempts',
      });
    });

    it('takes back a skip for a check nobody took up in time', () => {
      expect(keptSkipOf('nobody-checked', null)).toEqual({
        code: 'nobody-checked',
        detail: null,
      });
    });

    it('takes back a reported skip as a runner gave it', () => {
      expect(keptSkipOf('no-room', '  disk full  ')).toEqual({
        code: 'no-room',
        detail: 'disk full',
      });
      expect(() => keptSkipOf('made-up', null)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('never lets a runner say no runner could be provisioned', () => {
      expect(() => skipOf('unprovisioned', null)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('says how many attempts failed and what the last one was', () => {
      expect(unprovisioned(REFUSED, 5)).toEqual({
        code: 'unprovisioned',
        detail: '5 attempts; the last was refused: answered 503',
      });
    });
  });

  describe('provisioning a runner for it', () => {
    it('reserves a waiting check for the runner a pool is asked to start', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );

      expect(reserved.reservation?.runner).toEqual(RUNNER);
      expect(reserved.reservation?.pool.value).toBe('pool_burst');
      expect(reserved.reservation?.until).toEqual(RESERVED_UNTIL);
      expect(reserved.isReservedAt(LATER)).toBe(true);
    });

    it('reserves only a check still waiting for a runner to be provisioned', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );
      const claimed = waiting().claimedFor(RUNNER, ANY, LATER);
      const skipped = checking().skipped(
        RUNNER,
        skipOf('no-room', null),
        LATER,
      );

      expect(reserved.provisionableAt(LATER)).toBe(false);
      expect(claimed.provisionableAt(LATER)).toBe(false);
      expect(skipped.provisionableAt(LATER)).toBe(false);
      expect(() =>
        reserved.reservedFor(OTHER, PoolId.of('pool_burst'), LATER),
      ).toThrow(InvalidChangeStackError);
      expect(() =>
        claimed.reservedFor(OTHER, PoolId.of('pool_burst'), LATER),
      ).toThrow(InvalidChangeStackError);
      expect(() =>
        skipped.reservedFor(OTHER, PoolId.of('pool_burst'), LATER),
      ).toThrow(InvalidChangeStackError);
    });

    it('is hidden from every runner but the one reserved while it holds', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );

      expect(reserved.claimableAt(LATER)).toBe(false);
      expect(reserved.claimableAt(LATER, OTHER)).toBe(false);
      expect(reserved.claimableAt(LATER, RUNNER)).toBe(true);
      expect(() => reserved.claimedFor(OTHER, ANY, LATER)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('lets any runner claim it once the reservation lapses', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );

      expect(reserved.reservationLapsedAt(LATER)).toBe(false);
      expect(reserved.reservationLapsedAt(RESERVED_UNTIL)).toBe(true);
      expect(reserved.claimableAt(RESERVED_UNTIL, OTHER)).toBe(true);
      expect(
        reserved.claimedFor(OTHER, ANY, RESERVED_UNTIL).claim.claimedBy,
      ).toEqual(OTHER);
    });

    it('lets go of the reserved runner when another takes it after the reservation lapsed', () => {
      const taken = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .claimedFor(OTHER, ANY, RESERVED_UNTIL);

      expect(taken.reservation).toBeNull();
      expect(taken.pullEvents()).toEqual([
        new CheckReservationDropped(ChangeStackId.of('stack-1'), RUNNER),
      ]);
    });

    it('lets the reservation go once its runner claims it', () => {
      const claimed = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .claimedFor(RUNNER, ANY, LATER);

      expect(claimed.reservation).toBeNull();
      expect(claimed.claim.claimedBy).toEqual(RUNNER);
      expect(claimed.reservationLapsedAt(RESERVED_UNTIL)).toBe(false);
      expect(kinds(claimed)).toEqual([]);
    });

    it('lets the reservation go when the pool could not take it', () => {
      const check = waiting();
      const unreserved = check
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .unreservedFor(RUNNER);

      expect(unreserved.reservation).toBeNull();
      expect(kinds(unreserved)).toEqual([
        'change-stack.check-reservation-dropped',
      ]);
      expect(unreserved.provisioning.failures).toBe(0);
      expect(unreserved.provisionableAt(LATER)).toBe(true);
      expect(check.unreservedFor(RUNNER)).toBe(check);
    });

    it('keeps the reservation when another runner lets it go', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );

      expect(reserved.unreservedFor(OTHER)).toBe(reserved);
    });

    it('backs off after a failed provision and lets the reservation go', () => {
      const failed = failedAgain(waiting());

      expect(failed.reservation).toBeNull();
      expect(failed.provisioning.failures).toBe(1);
      expect(failed.stateAt(LATER)).toBe('waiting');
      expect(failed.provisionableAt(LATER)).toBe(false);
      expect(failed.provisionableAt(new Date(LATER.getTime() + 5_000))).toBe(
        true,
      );
      expect(kinds(failed)).toEqual(['change-stack.check-reservation-dropped']);
    });

    it('is skipped as unprovisioned after the fifth failed provision', () => {
      let check = waiting();

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        check = failedAgain(
          check,
          ProvisionFailure.of('unreachable', 'connect ECONNREFUSED'),
        );
      }

      expect(check.stateAt(LATER)).toBe('waiting');
      expect(kinds(check)).toEqual(
        Array(4).fill('change-stack.check-reservation-dropped'),
      );

      const skipped = failedAgain(check);

      expect(skipped.phase).toBe('skipped');
      expect(skipped.skippedAt(LATER)).toEqual({
        code: 'unprovisioned',
        detail: '5 attempts; the last was refused: answered 503',
      });
      expect(kinds(skipped)).toEqual([
        'change-stack.check-reservation-dropped',
        'change-stack.checked',
      ]);
      expect(
        checkReasonOf({
          skipped: skipped.skippedAt(LATER),
          wholeFailed: skipped.wholeFailed,
        }),
      ).toBe(
        'No runner could be provisioned to check the layers.\n\n5 attempts; the last was refused: answered 503',
      );
      expect(skipped.provisionFailed(RUNNER, REFUSED, LATER)).toBe(skipped);
    });

    it('counts no failure another runner reports', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );

      expect(reserved.provisionFailed(OTHER, REFUSED, LATER)).toBe(reserved);
    });

    it('counts no failure while a runner holds its lease', () => {
      const held = rehydrated({
        claim: CheckClaim.rehydrate({
          claimedBy: OTHER,
          attempts: 1,
          leaseExpiresAt: new Date(LATER.getTime() + 10 * 60_000),
          claimedAt: LATER,
        }),
        reservation: RunnerReservation.from(
          RUNNER,
          PoolId.of('pool_burst'),
          LATER,
        ),
      });

      expect(held.provisionFailed(RUNNER, REFUSED, LATER)).toBe(held);
    });

    it('only lets the reservation go when the pool fails it past the hour', () => {
      const failed = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .provisionFailed(RUNNER, REFUSED, OVERDUE);

      expect(failed.reservation).toBeNull();
      expect(failed.provisioning.failures).toBe(0);
      expect(failed.phase).toBe('waiting');
      expect(kinds(failed)).toEqual(['change-stack.check-reservation-dropped']);
    });

    it('comes back skipped as unprovisioned', () => {
      const skip = keptSkipOf(
        'unprovisioned',
        '5 attempts; the last was refused: answered 503',
      );
      const check = rehydrated({
        phase: 'skipped',
        outcome: {
          state: 'skipped',
          skip,
          whole: null,
          layers: [],
          checkedAt: LATER,
        },
        version: 1,
      });

      expect(check.skippedAt(LATER)).toEqual(skip);
    });

    it('starts provisioning afresh once its layers are reordered', () => {
      const reordering = failedAgain(waiting())
        .reservedFor(RUNNER, PoolId.of('pool_burst'), RESERVED_UNTIL)
        .claimedFor(RUNNER, ANY, RESERVED_UNTIL)
        .recorded(
          RUNNER,
          planned(),
          [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
          RESERVED_UNTIL,
        );

      const again = reordering.reordered(stack().entries(), RESERVED_UNTIL);

      expect(again.reservation).toBeNull();
      expect(again.provisioning.failures).toBe(0);
      expect(again.provisionableAt(RESERVED_UNTIL)).toBe(true);
    });
  });

  describe('settling a check nobody took up in time', () => {
    it('is overdue only once it has waited past the hour with no lease held', () => {
      const held = waiting().claimedFor(
        RUNNER,
        ANY,
        new Date(LATER.getTime() + WAITING_LIMIT_MS - 1),
      );

      expect(waiting().overdueAt(LATER)).toBe(false);
      expect(waiting().overdueAt(OVERDUE)).toBe(true);
      expect(held.overdueAt(OVERDUE)).toBe(false);
      expect(
        checking()
          .skipped(RUNNER, skipOf('no-room', null), LATER)
          .overdueAt(OVERDUE),
      ).toBe(false);
    });

    it('is skipped as nobody checked, letting any reservation go', () => {
      const settled = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .settledOverdue(OVERDUE);

      expect(settled.phase).toBe('skipped');
      expect(settled.reservation).toBeNull();
      expect(settled.skippedAt(OVERDUE)).toEqual({
        code: 'nobody-checked',
        detail: null,
      });
      expect(kinds(settled)).toEqual([
        'change-stack.check-reservation-dropped',
        'change-stack.checked',
      ]);
    });

    it('lets go of no runner where none was reserved for it', () => {
      expect(kinds(waiting().settledOverdue(OVERDUE))).toEqual([
        'change-stack.checked',
      ]);
    });

    it('refuses to settle a check that is not overdue', () => {
      expect(() => waiting().settledOverdue(LATER)).toThrow(
        InvalidChangeStackError,
      );
    });
  });

  describe('forgetting it with its task', () => {
    it('lets go of the runner reserved for it', () => {
      const forgotten = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .forgotten(LATER);

      expect(forgotten.reservation).toBeNull();
      expect(forgotten.pullEvents()).toEqual([
        new CheckReservationDropped(ChangeStackId.of('stack-1'), RUNNER),
      ]);
    });

    it('lets go of nobody where no runner was reserved for it', () => {
      expect(kinds(waiting().forgotten(LATER))).toEqual([]);
    });

    it('releases the runner still checking it', () => {
      const forgotten = checking().forgotten(LATER);

      expect(forgotten.claim.claimedBy).toBeNull();
      expect(forgotten.pullEvents()).toEqual([
        new HeldCheckForgotten(ChangeStackId.of('stack-1')),
      ]);
    });

    it('releases nobody once the checking runner’s lease ran out', () => {
      const check = checking();
      const lapsed = new Date(
        (check.claim.leaseExpiresAt?.getTime() ?? 0) + 1000,
      );

      expect(kinds(check.forgotten(lapsed))).toEqual([]);
    });
  });
});
