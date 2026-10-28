import { checkReasonOf } from '@change-review/application/rendering/check-reason';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import { LeasedCheckDeleted } from '@change-review/domain/events/leased-check-deleted.event';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { StackCheckNotLeasedError } from '@change-review/domain/exceptions/stack-check-not-leased.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  CheckClaim,
  MAX_CHECK_ATTEMPTS,
  MAX_LEASE_MS,
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
  parseStoredSkip,
  provisionFailed,
  skipOf,
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
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
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

const ANY = RunnerOffer.none();

const RESERVED_UNTIL = new Date(LATER.getTime() + 5 * 60_000);

const HTTP_ERROR = ProvisionFailure.of('http-error', 'answered 503');

const WAIT_EXPIRED = new Date(LATER.getTime() + WAITING_LIMIT_MS + 1);

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
    hunks: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
    notes: hunks.map((hunk) => ({
      path: DIFF.fileOf(hunk)?.path ?? hunk,
      note: 'Why it changes',
    })),
  })),
});

const stack = () =>
  ChangeStack.startGeneration({
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
  durationMs: 1200,
});

const kinds = (check: StackCheck) =>
  check.pullEvents().map((event) => event.kind);

const rehydrated = (over: Record<string, unknown>) =>
  StackCheck.rehydrate({
    stackId: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    replay: false,
    recheck: false,
    workspaceId: WorkspaceId.of('workspace-1'),
    request: CheckRequest.of('npx tsc --noEmit', null),
    status: 'waiting',
    entries: [],
    redraftCount: 0,
    outcome: null,
    claim: CheckClaim.none(),
    waitingSince: LATER,
    reservation: null,
    provisioning: Provisioning.none(),
    version: 0,
    ...over,
  });

const failedAgain = (check: StackCheck, failure = HTTP_ERROR) => {
  const due = check.provisioning.nextAttemptAt ?? LATER;

  return check
    .reservedFor(RUNNER, PoolId.of('pool_burst'), due)
    .provisionFailed(RUNNER, failure, due);
};

describe('StackCheck', () => {
  it('waits for a runner once the stack completes, and gives up after a while', () => {
    const check = waiting();

    expect(check.statusAt(LATER)).toBe('waiting');
    expect(
      check.statusAt(new Date(LATER.getTime() + WAITING_LIMIT_MS + 1)),
    ).toBe('skipped');
  });

  it('records what each layer’s check found', () => {
    const checked = checking().recordResult(
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

    expect(checked.outcome?.status).toBe('checked');
    expect(checked.failedLayers()).toEqual(['c1.l2']);
  });

  it('judges no layer where the finished change itself fails', () => {
    const checked = checking().recordResult(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, false, 'error TS2304')],
      LATER,
    );

    expect(checked.outcome).toMatchObject({ status: 'checked', layers: [] });
    expect(
      checkReasonOf({
        skipped: checked.skippedAt(LATER),
        wholeFailed: checked.wholeFailed,
      }),
    ).toBe(
      'The finished change fails the check. Spotlight didn’t check its layers one by one.',
    );
  });

  it('rejects steps the stack does not have, a missing whole, and a second report', () => {
    const check = checking();

    expect(() =>
      check.recordResult(RUNNER, planned(), [step('nowhere', true)], LATER),
    ).toThrow(InvalidChangeStackError);
    expect(() =>
      check.recordResult(RUNNER, planned(), [step('c1.l1', true)], LATER),
    ).toThrow(InvalidChangeStackError);

    const checked = check.recordResult(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true)],
      LATER,
    );

    expect(() =>
      checked.recordResult(RUNNER, planned(), [step(WHOLE_STEP, true)], LATER),
    ).toThrow(InvalidChangeStackError);
  });

  it('says why a runner could not check it, in its own words', () => {
    const skipped = checking().skip(
      RUNNER,
      skipOf('setup-failed', 'npm ci: no network'),
      LATER,
    );

    expect(skipped.statusAt(LATER)).toBe('skipped');
    expect(
      checkReasonOf({
        skipped: skipped.skippedAt(LATER),
        wholeFailed: skipped.wholeFailed,
      }),
    ).toBe(
      'The setup of the checkout failed before the check ran.\n\nnpm ci: no network',
    );
  });

  it('blames nobody in particular where no runner ever claimed it', () => {
    const check = waiting();
    const late = new Date(LATER.getTime() + WAITING_LIMIT_MS + 1);

    expect(
      checkReasonOf({
        skipped: check.skippedAt(late),
        wholeFailed: check.wholeFailed,
      }),
    ).toBe('No runner checked the layers in time.');
  });

  it('rejects a reason it does not know', () => {
    expect(() => skipOf('made-up', null)).toThrow(InvalidChangeStackError);
  });

  it('requests redrafting where the whole change builds but a layer does not', () => {
    const checked = checking().recordResult(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );

    expect(checked.redrafting).toBe(true);
    expect(kinds(checked)).toEqual(['change-stack.layers-failed-check']);
  });

  it('takes the redrafted layers and waits to be checked afresh', () => {
    const redrafting = checking().recordResult(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );
    const again = redrafting.redrafted(stack().entries(), LATER);

    expect(again.status).toBe('waiting');
    expect(again.redraftCount).toBe(1);
    expect(again.outcome).toBeNull();
  });

  it('retains the checked layers where redrafting stops', () => {
    const redrafting = checking().recordResult(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );
    redrafting.pullEvents();

    const checked = redrafting.retainCheckedLayers();

    expect(checked.statusAt(LATER)).toBe('checked');
    expect(kinds(checked)).toEqual(['change-stack.checked']);
  });

  it('drops a reservation when it takes redrafted layers', () => {
    const failing = checking().recordResult(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );
    const redrafting = rehydrated({
      status: 'redrafting',
      outcome: failing.outcome,
      reservation: RunnerReservation.from(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      ),
    });

    const again = redrafting.redrafted(stack().entries(), LATER);

    expect(again.reservation).toBeNull();
    expect(kinds(again)).toEqual(['change-stack.check-reservation-dropped']);
  });

  it('redrafts at most once', () => {
    const failing = (check: StackCheck) =>
      check
        .claimedFor(RUNNER, ANY, LATER)
        .recordResult(
          RUNNER,
          planned(),
          [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
          LATER,
        );

    const again = failing(waiting()).redrafted(stack().entries(), LATER);

    expect(failing(again).redrafting).toBe(false);
  });

  it('does not come back in a state it could not have entered', () => {
    expect(() => rehydrated({ status: 'checked' })).toThrow(
      InconsistentStateError,
    );
    expect(() => rehydrated({ redraftCount: -1 })).toThrow(
      InconsistentStateError,
    );
    expect(rehydrated({}).statusAt(LATER)).toBe('waiting');
  });

  describe('claiming it for a runner', () => {
    it('waits to be claimed once the stack completes', () => {
      expect(waiting().claimableAt(LATER)).toBe(true);
    });

    it('keeps the claim against a second runner until the lease runs out', () => {
      const leased = waiting().claimedFor(RUNNER, ANY, LATER);

      expect(leased.claimableAt(LATER)).toBe(false);
      expect(() => leased.claimedFor(OTHER, ANY, LATER)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('lets another runner claim it once the lease runs out', () => {
      const leased = waiting().claimedFor(RUNNER, ANY, LATER);
      const expired = new Date(
        (leased.claim.leaseExpiresAt?.getTime() ?? 0) + 1000,
      );

      expect(leased.claimableAt(expired)).toBe(true);
      expect(leased.claimedFor(OTHER, ANY, expired).claim.claimedBy).toEqual(
        OTHER,
      );
    });

    it('counts every claim and stops handing it out', () => {
      let check = waiting();
      let at = LATER;

      for (let round = 0; round < MAX_CHECK_ATTEMPTS; round += 1) {
        check = check.claimedFor(RUNNER, ANY, at);
        at = new Date((check.claim.leaseExpiresAt?.getTime() ?? 0) + 1000);
      }

      expect(check.claim.attempts).toBe(MAX_CHECK_ATTEMPTS);
      expect(check.claimableAt(at)).toBe(false);
    });

    it('is not there to claim once nobody checked it in time', () => {
      expect(
        waiting().claimableAt(new Date(LATER.getTime() + WAITING_LIMIT_MS + 1)),
      ).toBe(false);
    });

    it('rejects a runner that does not answer to where it is placed', () => {
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
      const laptop = RunnerOffer.of(['laptop']);

      expect(placed.claimableBy(RUNNER, laptop, LATER)).toBe(false);
      expect(() => placed.claimedFor(RUNNER, laptop, LATER)).toThrow(
        InvalidChangeStackError,
      );
      expect(
        placed.claimedFor(RUNNER, RunnerOffer.of(['vpc-internal']), LATER).claim
          .claimedBy,
      ).toEqual(RUNNER);
    });

    it('is being checked only by the runner with its lease', () => {
      const check = checking();
      const expired = new Date(
        (check.claim.leaseExpiresAt?.getTime() ?? 0) + 1000,
      );

      expect(check.beingCheckedBy(RUNNER, LATER)).toBe(true);
      expect(check.beingCheckedBy(OTHER, LATER)).toBe(false);
      expect(check.beingCheckedBy(RUNNER, expired)).toBe(false);
    });

    it('takes what was found only from the runner with the lease', () => {
      const check = checking();

      expect(() =>
        check.recordResult(OTHER, planned(), [step(WHOLE_STEP, true)], LATER),
      ).toThrow(StackCheckNotLeasedError);
      expect(() =>
        check.skip(OTHER, skipOf('workspace-failed', null), LATER),
      ).toThrow(StackCheckNotLeasedError);
      expect(() =>
        waiting().recordResult(
          RUNNER,
          planned(),
          [step(WHOLE_STEP, true)],
          LATER,
        ),
      ).toThrow(StackCheckNotLeasedError);
      expect(() =>
        waiting().skip(RUNNER, skipOf('workspace-failed', null), LATER),
      ).toThrow(StackCheckNotLeasedError);
    });

    it('drops the claim once the check is recorded or skipped', () => {
      const leased = waiting().claimedFor(RUNNER, ANY, LATER);

      expect(
        leased.recordResult(RUNNER, planned(), [step(WHOLE_STEP, true)], LATER)
          .claim.claimedBy,
      ).toBeNull();
      expect(
        leased.skip(RUNNER, skipOf('workspace-failed', null), LATER).claim
          .claimedBy,
      ).toBeNull();
    });
  });

  describe('renewing the lease of the runner checking it', () => {
    const leaseOf = (check: StackCheck) =>
      check.claim.leaseExpiresAt?.getTime() ?? 0;

    it('renews the lease of the runner past the first lease period', () => {
      const check = checking();
      const nearlyExpired = new Date(leaseOf(check) - 1000);
      const renewed = check.renewedFor(RUNNER, nearlyExpired);
      const pastFirstLease = new Date(leaseOf(check) + 1000);

      expect(leaseOf(renewed)).toBeGreaterThan(leaseOf(check));
      expect(renewed.beingCheckedBy(RUNNER, pastFirstLease)).toBe(true);
      expect(renewed.claimableAt(pastFirstLease)).toBe(false);
      expect(renewed.claim.attempts).toBe(check.claim.attempts);
      expect(renewed.pullEvents()).toEqual([]);
    });

    it('is renewed only by the runner with the lease', () => {
      const check = checking();
      const expired = new Date(leaseOf(check) + 1000);

      expect(() => check.renewedFor(OTHER, LATER)).toThrow(
        StackCheckNotLeasedError,
      );
      expect(() => check.renewedFor(RUNNER, expired)).toThrow(
        StackCheckNotLeasedError,
      );
      expect(() => waiting().renewedFor(RUNNER, LATER)).toThrow(
        StackCheckNotLeasedError,
      );
    });

    it('is not renewed once the check was recorded or skipped', () => {
      const check = checking();
      const recorded = check.recordResult(
        RUNNER,
        planned(),
        [step(WHOLE_STEP, true)],
        LATER,
      );
      const skipped = check.skip(
        RUNNER,
        skipOf('workspace-failed', null),
        LATER,
      );

      expect(recorded.checkableAt(LATER)).toBe(false);
      expect(skipped.checkableAt(LATER)).toBe(false);
      expect(() => recorded.renewedFor(RUNNER, LATER)).toThrow(
        InvalidChangeStackError,
      );
      expect(() => skipped.renewedFor(RUNNER, LATER)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('keeps being renewed past the hour while its runner has the lease', () => {
      const check = waiting().claimedFor(
        RUNNER,
        ANY,
        new Date(WAIT_EXPIRED.getTime() - 60_000),
      );

      const renewed = check.renewedFor(RUNNER, WAIT_EXPIRED);
      const pastFirstLease = new Date(leaseOf(check) + 1000);

      expect(check.statusAt(WAIT_EXPIRED)).toBe('waiting');
      expect(check.checkableAt(WAIT_EXPIRED)).toBe(true);
      expect(renewed.beingCheckedBy(RUNNER, pastFirstLease)).toBe(true);
      expect(renewed.waitExpiredAt(pastFirstLease)).toBe(false);
      expect(() => renewed.renewedFor(RUNNER, pastFirstLease)).not.toThrow();
    });

    it('still takes what was found past the hour while its runner has the lease', () => {
      const check = waiting().claimedFor(
        RUNNER,
        ANY,
        new Date(WAIT_EXPIRED.getTime() - 60_000),
      );

      const recorded = check.recordResult(
        RUNNER,
        planned(),
        [step(WHOLE_STEP, true)],
        WAIT_EXPIRED,
      );

      expect(recorded.status).toBe('checked');
      expect(recorded.statusAt(WAIT_EXPIRED)).toBe('checked');
    });

    it('is skipped as a queue timeout once its runner’s lease expires past the hour', () => {
      const check = waiting().claimedFor(
        RUNNER,
        ANY,
        new Date(WAIT_EXPIRED.getTime() - 60_000),
      );
      const expired = new Date(leaseOf(check));

      expect(check.statusAt(expired)).toBe('skipped');
      expect(check.checkableAt(expired)).toBe(false);
      expect(check.waitExpiredAt(expired)).toBe(true);
      expect(() => check.renewedFor(RUNNER, expired)).toThrow(
        InvalidChangeStackError,
      );
      expect(() =>
        check.recordResult(
          RUNNER,
          planned(),
          [step(WHOLE_STEP, true)],
          expired,
        ),
      ).toThrow(InvalidChangeStackError);
      expect(check.expireWait(expired).skippedAt(expired)).toEqual({
        code: 'queue-timeout',
        detail: null,
      });
    });
  });

  describe('leasing it for as long as a check may be leased', () => {
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
    const ceiling = new Date(LATER.getTime() + MAX_LEASE_MS);
    const justBefore = new Date(ceiling.getTime() - 1000);

    it('keeps its runner renewing up to the ceiling', () => {
      const renewed = renewedUntil(checking(), justBefore);

      expect(renewed.claim.claimedAt).toEqual(LATER);
      expect(renewed.beingCheckedBy(RUNNER, justBefore)).toBe(true);
      expect(renewed.statusAt(justBefore)).toBe('waiting');
    });

    it('releases a runner that keeps renewing past the ceiling and expires it as a queue timeout', () => {
      const renewed = renewedUntil(checking(), justBefore);

      expect(renewed.claim.leaseExpiresAt?.getTime()).toBeGreaterThan(
        ceiling.getTime(),
      );
      expect(renewed.beingCheckedBy(RUNNER, ceiling)).toBe(false);
      expect(renewed.statusAt(ceiling)).toBe('skipped');
      expect(renewed.checkableAt(ceiling)).toBe(false);
      expect(() => renewed.renewedFor(RUNNER, ceiling)).toThrow(
        InvalidChangeStackError,
      );
      expect(() =>
        renewed.recordResult(
          RUNNER,
          planned(),
          [step(WHOLE_STEP, true)],
          ceiling,
        ),
      ).toThrow(InvalidChangeStackError);
      expect(renewed.waitExpiredAt(ceiling)).toBe(true);
      expect(renewed.expireWait(ceiling).skippedAt(ceiling)).toEqual({
        code: 'queue-timeout',
        detail: null,
      });
    });

    it('does not renew the claim itself past the ceiling', () => {
      const claim = checking().claim;

      expect(() => claim.renewed(justBefore)).not.toThrow();
      expect(() => claim.renewed(ceiling)).toThrow(InvalidChangeStackError);
    });

    it('rejects a claim stored with no time it was claimed', () => {
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

    it('is unclaimed only by the runner with the lease', () => {
      const leased = waiting().claimedFor(RUNNER, ANY, LATER);

      expect(() => leased.unclaimedBy(OTHER, LATER)).toThrow(
        StackCheckNotLeasedError,
      );
      expect(() => waiting().unclaimedBy(RUNNER, LATER)).toThrow(
        StackCheckNotLeasedError,
      );
    });
  });

  describe('storing why it was skipped', () => {
    it('takes back a skip no runner could have reported', () => {
      expect(parseStoredSkip('provision-failed', '5 attempts')).toEqual({
        code: 'provision-failed',
        detail: '5 attempts',
      });
    });

    it('takes back a skip for a check nobody claimed in time', () => {
      expect(parseStoredSkip('queue-timeout', null)).toEqual({
        code: 'queue-timeout',
        detail: null,
      });
    });

    it('takes back a reported skip as a runner reported it', () => {
      expect(parseStoredSkip('workspace-failed', '  disk full  ')).toEqual({
        code: 'workspace-failed',
        detail: 'disk full',
      });
      expect(() => parseStoredSkip('made-up', null)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('never lets a runner say no runner could be provisioned', () => {
      expect(() => skipOf('provision-failed', null)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('says how many attempts failed and what the last one was', () => {
      expect(provisionFailed(HTTP_ERROR, 5)).toEqual({
        code: 'provision-failed',
        detail: 'Attempts: 5\nLast failure: http-error: answered 503',
      });
    });
  });

  describe('provisioning a runner for it', () => {
    it('reserves a waiting check for the runner a pool is requested to start', () => {
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
      const skipped = checking().skip(
        RUNNER,
        skipOf('workspace-failed', null),
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

    it('is hidden from every runner but the one reserved while the reservation is active', () => {
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

    it('lets any runner claim it once the reservation expires', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );

      expect(reserved.reservationExpiredAt(LATER)).toBe(false);
      expect(reserved.reservationExpiredAt(RESERVED_UNTIL)).toBe(true);
      expect(reserved.claimableAt(RESERVED_UNTIL, OTHER)).toBe(true);
      expect(
        reserved.claimedFor(OTHER, ANY, RESERVED_UNTIL).claim.claimedBy,
      ).toEqual(OTHER);
    });

    it('releases the reserved runner when another claims it after the reservation expired', () => {
      const taken = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .claimedFor(OTHER, ANY, RESERVED_UNTIL);

      expect(taken.reservation).toBeNull();
      expect(taken.pullEvents()).toEqual([
        new CheckReservationDropped(ChangeStackId.of('stack-1'), RUNNER),
      ]);
    });

    it('drops the reservation once its runner claims it', () => {
      const claimed = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .claimedFor(RUNNER, ANY, LATER);

      expect(claimed.reservation).toBeNull();
      expect(claimed.claim.claimedBy).toEqual(RUNNER);
      expect(claimed.reservationExpiredAt(RESERVED_UNTIL)).toBe(false);
      expect(kinds(claimed)).toEqual([]);
    });

    it('drops the reservation when the pool could not take it', () => {
      const check = waiting();
      const unreserved = check
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .unreservedFor(RUNNER);

      expect(unreserved.reservation).toBeNull();
      expect(kinds(unreserved)).toEqual([
        'change-stack.check-reservation-dropped',
      ]);
      expect(unreserved.provisioning.attempts).toBe(0);
      expect(unreserved.provisionableAt(LATER)).toBe(true);
      expect(check.unreservedFor(RUNNER)).toBe(check);
    });

    it('keeps the reservation when another runner drops it', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );

      expect(reserved.unreservedFor(OTHER)).toBe(reserved);
    });

    it('schedules a retry after a failed provision and drops the reservation', () => {
      const failed = failedAgain(waiting());

      expect(failed.reservation).toBeNull();
      expect(failed.provisioning.attempts).toBe(1);
      expect(failed.statusAt(LATER)).toBe('waiting');
      expect(failed.provisionableAt(LATER)).toBe(false);
      expect(failed.provisionableAt(new Date(LATER.getTime() + 5_000))).toBe(
        true,
      );
      expect(kinds(failed)).toEqual(['change-stack.check-reservation-dropped']);
    });

    it('is skipped as provision-failed after the fifth failed provision', () => {
      let check = waiting();

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        check = failedAgain(
          check,
          ProvisionFailure.of('unreachable', 'connect ECONNREFUSED'),
        );
      }

      expect(check.statusAt(LATER)).toBe('waiting');
      expect(kinds(check)).toEqual(
        Array(4).fill('change-stack.check-reservation-dropped'),
      );

      const skipped = failedAgain(check);

      expect(skipped.status).toBe('skipped');
      expect(skipped.skippedAt(LATER)).toEqual({
        code: 'provision-failed',
        detail: 'Attempts: 5\nLast failure: http-error: answered 503',
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
        'Spotlight couldn’t provision a runner to check the layers.\n\nAttempts: 5\nLast failure: http-error: answered 503',
      );
      expect(skipped.provisionFailed(RUNNER, HTTP_ERROR, LATER)).toBe(skipped);
    });

    it('counts no failure another runner reports', () => {
      const reserved = waiting().reservedFor(
        RUNNER,
        PoolId.of('pool_burst'),
        LATER,
      );

      expect(reserved.provisionFailed(OTHER, HTTP_ERROR, LATER)).toBe(reserved);
    });

    it('counts no failure while a runner has its lease', () => {
      const leased = rehydrated({
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

      expect(leased.provisionFailed(RUNNER, HTTP_ERROR, LATER)).toBe(leased);
    });

    it('only drops the reservation when the pool fails it past the hour', () => {
      const failed = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .provisionFailed(RUNNER, HTTP_ERROR, WAIT_EXPIRED);

      expect(failed.reservation).toBeNull();
      expect(failed.provisioning.attempts).toBe(0);
      expect(failed.status).toBe('waiting');
      expect(kinds(failed)).toEqual(['change-stack.check-reservation-dropped']);
    });

    it('comes back skipped as provision-failed', () => {
      const skip = parseStoredSkip(
        'provision-failed',
        'Attempts: 5\nLast failure: http-error: answered 503',
      );
      const check = rehydrated({
        status: 'skipped',
        outcome: {
          status: 'skipped',
          skip,
          whole: null,
          layers: [],
          checkedAt: LATER,
        },
        version: 1,
      });

      expect(check.skippedAt(LATER)).toEqual(skip);
    });

    it('starts provisioning afresh once its layers are redrafted', () => {
      const redrafting = failedAgain(waiting())
        .reservedFor(RUNNER, PoolId.of('pool_burst'), RESERVED_UNTIL)
        .claimedFor(RUNNER, ANY, RESERVED_UNTIL)
        .recordResult(
          RUNNER,
          planned(),
          [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
          RESERVED_UNTIL,
        );

      const again = redrafting.redrafted(stack().entries(), RESERVED_UNTIL);

      expect(again.reservation).toBeNull();
      expect(again.provisioning.attempts).toBe(0);
      expect(again.provisionableAt(RESERVED_UNTIL)).toBe(true);
    });
  });

  describe('expiring a check nobody claimed in time', () => {
    it('expires its wait only once it has waited past the hour with no active lease', () => {
      const leased = waiting().claimedFor(
        RUNNER,
        ANY,
        new Date(LATER.getTime() + WAITING_LIMIT_MS - 1),
      );

      expect(waiting().waitExpiredAt(LATER)).toBe(false);
      expect(waiting().waitExpiredAt(WAIT_EXPIRED)).toBe(true);
      expect(leased.waitExpiredAt(WAIT_EXPIRED)).toBe(false);
      expect(
        checking()
          .skip(RUNNER, skipOf('workspace-failed', null), LATER)
          .waitExpiredAt(WAIT_EXPIRED),
      ).toBe(false);
    });

    it('is skipped as a queue timeout, and drops any reservation', () => {
      const expired = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .expireWait(WAIT_EXPIRED);

      expect(expired.status).toBe('skipped');
      expect(expired.reservation).toBeNull();
      expect(expired.skippedAt(WAIT_EXPIRED)).toEqual({
        code: 'queue-timeout',
        detail: null,
      });
      expect(kinds(expired)).toEqual([
        'change-stack.check-reservation-dropped',
        'change-stack.checked',
      ]);
    });

    it('releases no runner where none was reserved for it', () => {
      expect(kinds(waiting().expireWait(WAIT_EXPIRED))).toEqual([
        'change-stack.checked',
      ]);
    });

    it('does not expire a check whose wait has not expired', () => {
      expect(() => waiting().expireWait(LATER)).toThrow(
        InvalidChangeStackError,
      );
    });
  });

  describe('deleting it with its task', () => {
    it('releases the runner reserved for it', () => {
      const deleted = waiting()
        .reservedFor(RUNNER, PoolId.of('pool_burst'), LATER)
        .delete(LATER);

      expect(deleted.reservation).toBeNull();
      expect(deleted.pullEvents()).toEqual([
        new CheckReservationDropped(ChangeStackId.of('stack-1'), RUNNER),
      ]);
    });

    it('releases nobody where no runner was reserved for it', () => {
      expect(kinds(waiting().delete(LATER))).toEqual([]);
    });

    it('releases the runner still checking it', () => {
      const deleted = checking().delete(LATER);

      expect(deleted.claim.claimedBy).toBeNull();
      expect(deleted.pullEvents()).toEqual([
        new LeasedCheckDeleted(ChangeStackId.of('stack-1')),
      ]);
    });

    it('releases nobody once the checking runner’s lease ran out', () => {
      const check = checking();
      const expired = new Date(
        (check.claim.leaseExpiresAt?.getTime() ?? 0) + 1000,
      );

      expect(kinds(check.delete(expired))).toEqual([]);
    });
  });
});

describe('StackCheck, rechecked', () => {
  const replayed = () => {
    const ready = stack();
    const check = StackCheck.begin({
      stackId: ready.id,
      runId: ready.runId,
      taskId: null,
      replay: true,
      workspaceId: ready.workspaceId,
      request: CheckRequest.of('npx tsc --noEmit', null),
      entries: ready.entries(),
      now: LATER,
    }).claimedFor(RUNNER, ANY, LATER);

    check.pullEvents();
    return check;
  };

  const passedOnce = () => {
    const checked = replayed().recordResult(
      RUNNER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', true)],
      LATER,
    );

    checked.pullEvents();
    return checked;
  };

  it('checks a replay’s change again, from scratch, under the same request and layers, and leaves the first check as it was', () => {
    const first = passedOnce();
    const again = first.rechecking(WAIT_EXPIRED);

    expect(again.recheck).toBe(true);
    expect(again.stackId.equals(first.stackId)).toBe(true);
    expect(again.status).toBe('waiting');
    expect(again.outcome).toBeNull();
    expect(again.waitingSince).toEqual(WAIT_EXPIRED);
    expect(again.request.command).toBe(first.request.command);
    expect(again.entries).toEqual(first.entries);
    expect(again.claimableAt(WAIT_EXPIRED)).toBe(true);
    expect(first.status).toBe('checked');
  });

  it('says what the recheck found as a recheck, and never requests to redraft the stack', () => {
    const again = passedOnce().rechecking(LATER).claimedFor(OTHER, ANY, LATER);
    const found = again.recordResult(
      OTHER,
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false)],
      LATER,
    );

    expect(found.status).toBe('checked');
    expect(
      found.pullEvents().map((event) => ({
        kind: event.kind,
        recheck: (event as { recheck?: boolean }).recheck,
      })),
    ).toEqual([{ kind: 'change-stack.checked', recheck: true }]);
  });

  it('rechecks only a replay’s change whose first check found something, and only once', () => {
    expect(() => replayed().rechecking(LATER)).toThrow(InvalidChangeStackError);
    expect(() =>
      checking()
        .recordResult(RUNNER, planned(), [step(WHOLE_STEP, true)], LATER)
        .rechecking(LATER),
    ).toThrow(InvalidChangeStackError);
    expect(() => passedOnce().rechecking(LATER).rechecking(LATER)).toThrow(
      InvalidChangeStackError,
    );
  });

  it('does not come back as a recheck of a task’s change, or as one that redrafted', () => {
    expect(() => rehydrated({ recheck: true })).toThrow(InconsistentStateError);
    expect(() =>
      rehydrated({ recheck: true, replay: true, redraftCount: 1 }),
    ).toThrow(InconsistentStateError);
    expect(rehydrated({ recheck: true, replay: true }).recheck).toBe(true);
  });
});
