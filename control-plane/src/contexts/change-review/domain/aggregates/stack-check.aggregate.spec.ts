import { checkReasonOf } from '@change-review/application/rendering/check-reason';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import {
  StackCheck,
  WAITING_LIMIT_MS,
} from '@change-review/domain/aggregates/stack-check.aggregate';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  CheckClaim,
  MOST_CHECK_ATTEMPTS,
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
  skipOf,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
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
    workspaceId: ready.workspaceId,
    request: CheckRequest.of('npx tsc --noEmit', null),
    entries: ready.entries(),
    now: LATER,
  });

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
    const checked = waiting().recorded(
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
    const checked = waiting().recorded(
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
    const check = waiting();

    expect(() =>
      check.recorded(planned(), [step('nowhere', true)], LATER),
    ).toThrow(InvalidChangeStackError);
    expect(() =>
      check.recorded(planned(), [step('c1.l1', true)], LATER),
    ).toThrow(InvalidChangeStackError);

    const checked = check.recorded(planned(), [step(WHOLE_STEP, true)], LATER);

    expect(() =>
      checked.recorded(planned(), [step(WHOLE_STEP, true)], LATER),
    ).toThrow(InvalidChangeStackError);
  });

  it('says why a runner could not check it, in its own words', () => {
    const skipped = waiting().skipped(
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
    const checked = waiting().recorded(
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );

    expect(checked.reordering).toBe(true);
    expect(kinds(checked)).toEqual(['change-stack.layers-failed-check']);
  });

  it('takes the reordered layers and waits to be checked afresh', () => {
    const reordering = waiting().recorded(
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
    const reordering = waiting().recorded(
      planned(),
      [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
      LATER,
    );
    reordering.pullEvents();

    const kept = reordering.keptLayers();

    expect(kept.stateAt(LATER)).toBe('checked');
    expect(kinds(kept)).toEqual(['change-stack.checked']);
  });

  it('reorders at most once', () => {
    const failing = (check: StackCheck) =>
      check.recorded(
        planned(),
        [step(WHOLE_STEP, true), step('c1.l1', false, 'error')],
        LATER,
      );

    const again = failing(waiting()).reordered(stack().entries(), LATER);

    expect(failing(again).reordering).toBe(false);
  });

  it('refuses to come back in a state it could not have reached', () => {
    const rehydrated = (over: Record<string, unknown>) =>
      StackCheck.rehydrate({
        stackId: ChangeStackId.of('stack-1'),
        runId: RunId.of('run-1'),
        workspaceId: WorkspaceId.of('workspace-1'),
        request: CheckRequest.of('npx tsc --noEmit', null),
        phase: 'waiting',
        entries: [],
        rounds: 0,
        outcome: null,
        claim: CheckClaim.none(),
        waitingSince: LATER,
        version: 0,
        ...over,
      });

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
      const held = waiting().claimedFor(RUNNER, LATER);

      expect(held.claimableAt(LATER)).toBe(false);
      expect(() => held.claimedFor(OTHER, LATER)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('lets another runner take it up once the lease runs out', () => {
      const held = waiting().claimedFor(RUNNER, LATER);
      const lapsed = new Date(
        (held.claim.leaseExpiresAt?.getTime() ?? 0) + 1000,
      );

      expect(held.claimableAt(lapsed)).toBe(true);
      expect(held.claimedFor(OTHER, lapsed).claim.claimedBy).toEqual(OTHER);
    });

    it('counts every claim and stops handing it out', () => {
      let check = waiting();
      let at = LATER;

      for (let round = 0; round < MOST_CHECK_ATTEMPTS; round += 1) {
        check = check.claimedFor(RUNNER, at);
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

    it('renews only for the runner holding it', () => {
      const held = waiting().claimedFor(RUNNER, LATER);
      const later = new Date(LATER.getTime() + 1000);

      expect(
        held.renewedFor(RUNNER, later).claim.leaseExpiresAt?.getTime(),
      ).toBeGreaterThan(held.claim.leaseExpiresAt?.getTime() ?? 0);
      expect(() => held.renewedFor(OTHER, later)).toThrow(
        InvalidChangeStackError,
      );
    });

    it('lets the claim go once the check is recorded or skipped', () => {
      const held = waiting().claimedFor(RUNNER, LATER);

      expect(
        held.recorded(planned(), [step(WHOLE_STEP, true)], LATER).claim
          .claimedBy,
      ).toBeNull();
      expect(
        held.skipped(skipOf('no-room', null), LATER).claim.claimedBy,
      ).toBeNull();
    });
  });
});
