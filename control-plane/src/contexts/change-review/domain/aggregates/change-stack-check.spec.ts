import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type { CheckedStep } from '@change-review/domain/value-objects/stack-check.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { CHECKING_LIMIT_MS } from '@change-review/domain/value-objects/stack-progress.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const changed = (path: string, at: number): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: `h${at + 1}`,
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
    ranges: hunks.map((hunk) => ({ hunk, summary: null })),
  })),
});

const ready = (check: string | null = 'npx tsc --noEmit') => {
  const stack = ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    diff: DIFF,
    facts: StackFacts.none(),
    check,
    now: NOW,
  }).propose(
    [
      cohort('Invitations', [['h1'], ['h2', 'h3']]),
      cohort('Docs', [['h5']]),
      cohort('Lockfile', [['h4']], 'incidental'),
    ],
    LATER,
  );

  stack.pullEvents();
  return stack;
};

const passed = (step: string, output = ''): CheckedStep => ({
  step,
  passed: true,
  output,
  tookMs: 1200,
});

describe('ChangeStack check', () => {
  it('has no check where none was named', () => {
    expect(ready(null).checkStateAt(LATER)).toBeNull();
  });

  it('refuses a check command that is not one short line', () => {
    expect(() => ready('npx tsc\nrm -rf /')).toThrow(InvalidChangeStackError);
  });

  it('waits for a runner once drafted, and gives up after a while', () => {
    const stack = ready();

    expect(stack.checkStateAt(LATER)).toBe('waiting');
    expect(
      stack.checkStateAt(new Date(LATER.getTime() + CHECKING_LIMIT_MS + 1)),
    ).toBe('skipped');
  });

  it('checks the whole change, then each layer on top of the layers before it and the incidental changes', () => {
    expect(ready().checkSteps()).toEqual([
      { id: 'whole', hunks: ['h1', 'h2', 'h3', 'h4', 'h5'] },
      { id: 'c1.l1', hunks: ['h4', 'h1'] },
      { id: 'c1.l2', hunks: ['h4', 'h1', 'h2', 'h3'] },
      { id: 'c2.l1', hunks: ['h4', 'h5'] },
    ]);
  });

  it('keeps what each layer’s check found', () => {
    const checked = ready().recordCheck(
      [
        passed('whole'),
        passed('c1.l1'),
        {
          step: 'c1.l2',
          passed: false,
          output: 'x'.repeat(20_000),
          tookMs: 9.6,
        },
        passed('c2.l1'),
      ],
      LATER,
    );

    expect(checked.checkStateAt(LATER)).toBe('waiting');
    expect(checked.keepLayers().checkStateAt(LATER)).toBe('checked');
    expect(
      checked.check?.outcome?.layers.map((each) => [each.step, each.passed]),
    ).toEqual([
      ['c1.l1', true],
      ['c1.l2', false],
      ['c2.l1', true],
    ]);
    expect(checked.check?.outcome?.layers[1]?.output).toHaveLength(16_000);
    expect(checked.check?.outcome?.layers[1]?.tookMs).toBe(10);
  });

  it('judges no layer where the finished change itself fails', () => {
    const checked = ready().recordCheck(
      [{ step: 'whole', passed: false, output: 'error TS2304', tookMs: 1 }],
      LATER,
    );

    expect(checked.check?.outcome).toMatchObject({
      state: 'checked',
      layers: [],
      reason:
        'The finished change does not pass the check, so its layers were not checked on their own.',
    });
  });

  it('gives a layer that holds the whole change the whole change’s result', () => {
    const single = ChangeStack.draft({
      id: ChangeStackId.of('stack-2'),
      runId: RunId.of('run-1'),
      taskId: null,
      workspaceId: WorkspaceId.of('workspace-1'),
      repository: null,
      diff: DIFF,
      facts: StackFacts.none(),
      check: 'go build ./...',
      now: NOW,
    }).propose(
      [
        cohort('All', [
          ['h1', 'h2'],
          ['h3', 'h4', 'h5'],
        ]),
      ],
      LATER,
    );

    expect(single.checkSteps().map((step) => step.id)).toEqual([
      'whole',
      'c1.l1',
    ]);
    expect(
      single
        .recordCheck([passed('whole', 'ok'), passed('c1.l1')], LATER)
        .check?.outcome?.layers.map((each) => [each.step, each.output]),
    ).toEqual([
      ['c1.l1', ''],
      ['c1.l2', 'ok'],
    ]);
  });

  it('refuses steps the stack does not have, a missing whole, and a second report', () => {
    expect(() => ready().recordCheck([passed('c9.l1')], LATER)).toThrow(
      InvalidChangeStackError,
    );

    const checked = ready().recordCheck([passed('whole')], LATER);

    expect(() => checked.recordCheck([passed('whole')], LATER)).toThrow(
      InvalidChangeStackError,
    );
    expect(() => checked.skipCheck('again', LATER)).toThrow(
      InvalidChangeStackError,
    );
  });

  it('says why a runner could not check it', () => {
    const skipped = ready().skipCheck('No checkout named api', LATER);

    expect(skipped.checkStateAt(LATER)).toBe('skipped');
    expect(skipped.checkReasonAt(LATER)).toBe('No checkout named api');
  });
});

describe('ChangeStack reordering after its check', () => {
  const failing = () =>
    ready().recordCheck(
      [
        passed('whole'),
        passed('c1.l1'),
        { step: 'c1.l2', passed: false, output: 'error TS2304', tookMs: 1 },
        passed('c2.l1'),
      ],
      LATER,
    );

  const kinds = (stack: ChangeStack) =>
    stack.pullEvents().map((event) => event.kind);

  it('starts reordering a stack whose whole change builds but some layer does not, and says so', () => {
    expect(failing().check?.reordering).toBe(true);
    expect(kinds(failing())).toEqual(['change-stack.layers-failed-check']);

    const built = ready().recordCheck(
      [passed('whole'), passed('c1.l1'), passed('c1.l2'), passed('c2.l1')],
      LATER,
    );
    expect(built.check?.reordering).toBe(false);
    expect(kinds(built)).toEqual(['change-stack.checked']);

    expect(
      ready().recordCheck(
        [{ step: 'whole', passed: false, output: 'x', tookMs: 1 }],
        LATER,
      ).check?.reordering,
    ).toBe(false);
  });

  it('waits while it is reordered, and takes no check meanwhile', () => {
    const reordering = failing();

    expect(reordering.checkStateAt(LATER)).toBe('waiting');
    expect(() => reordering.recordCheck([passed('whole')], LATER)).toThrow(
      InvalidChangeStackError,
    );
  });

  it('takes the reordered layers, and waits for them to be checked afresh', () => {
    const failed = failing();
    failed.pullEvents();

    const reordered = failed.reordered(
      [
        cohort('Invitations', [['h1', 'h2', 'h3']]),
        cohort('Docs', [['h5']]),
        cohort('Lockfile', [['h4']], 'incidental'),
      ],
      LATER,
      false,
    );

    expect(reordered.cohorts[0]?.layers).toHaveLength(1);
    expect(reordered.check).toMatchObject({
      rounds: 1,
      phase: 'waiting',
      outcome: null,
    });
    expect(reordered.checkStateAt(LATER)).toBe('waiting');
    expect(kinds(reordered)).toEqual(['change-stack.settled']);

    const again = reordered.recordCheck(
      [
        passed('whole'),
        { step: 'c2.l1', passed: false, output: 'x', tookMs: 1 },
      ],
      LATER,
    );
    expect(again.check?.reordering).toBe(false);
    expect(kinds(again)).toEqual(['change-stack.checked']);
  });

  it('refuses joining layers on a strict attempt, and takes moved changes', () => {
    const joined = () =>
      failing().reordered(
        [
          cohort('Invitations', [['h1', 'h2', 'h3']]),
          cohort('Docs', [['h5']]),
          cohort('Lockfile', [['h4']], 'incidental'),
        ],
        LATER,
        true,
      );

    expect(joined).toThrow('joins layers, leaving 2 where there were 3');

    const moved = failing().reordered(
      [
        cohort('Invitations', [['h1', 'h3'], ['h2']]),
        cohort('Docs', [['h5']]),
        cohort('Lockfile', [['h4']], 'incidental'),
      ],
      LATER,
      true,
    );

    expect(
      moved.cohorts[0]?.layers.map((layer) =>
        layer.ranges.map((range) => range.hunk),
      ),
    ).toEqual([['h1', 'h3'], ['h2']]);
  });

  it('waits however long reordering takes, and keeps its layers once reordering is given up', () => {
    const lapsed = new Date(LATER.getTime() + CHECKING_LIMIT_MS + 1);
    const reordering = failing();

    expect(reordering.owesWork).toBe(true);
    expect(reordering.checkStateAt(lapsed)).toBe('waiting');

    const kept = reordering.gaveUp(lapsed);

    expect(kept.owesWork).toBe(false);
    expect(kept.checkStateAt(lapsed)).toBe('checked');
  });

  it('keeps the events of every step it takes', () => {
    const stack = ChangeStack.draft({
      id: ChangeStackId.of('stack-3'),
      runId: RunId.of('run-1'),
      taskId: null,
      workspaceId: WorkspaceId.of('workspace-1'),
      repository: null,
      diff: DIFF,
      facts: StackFacts.none(),
      check: 'npx tsc --noEmit',
      now: NOW,
    })
      .propose([cohort('All', [['h1', 'h2', 'h3', 'h4', 'h5']])], LATER)
      .recordCheck([passed('whole')], LATER);

    expect(kinds(stack)).toEqual([
      'change-stack.drafting-began',
      'change-stack.settled',
      'change-stack.checked',
    ]);
  });

  it('keeps the checked layers where reordering does not work out', () => {
    const kept = failing().keepLayers();

    expect(kept.check?.reordering).toBe(false);
    expect(kinds(kept)).toEqual([
      'change-stack.layers-failed-check',
      'change-stack.checked',
    ]);
    expect(kept.checkStateAt(LATER)).toBe('checked');
    expect(kept.cohorts).toEqual(failing().cohorts);
  });
});
