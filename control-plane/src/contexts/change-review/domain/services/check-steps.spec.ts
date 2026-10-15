import { checkStepsOf } from '@change-review/domain/services/check-steps';
import type { FileClass } from '@change-review/domain/services/diff-facts';
import type { StackCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  CohortId,
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';
import { describe, expect, it } from 'vitest';

const facts = (classes: Readonly<Record<string, FileClass>>) => ({
  isGenerated: (hunk: string) => classes[hunk] === 'generated',
  classOf: (hunk: string) => classes[hunk] ?? 'source',
});

const cohort = (
  id: string,
  layers: Readonly<Record<string, string[]>>,
  kind: StackCohort['kind'] = 'change',
): StackCohort => ({
  id: CohortId.of(id),
  kind,
  title: id,
  intent: id,
  layers: Object.entries(layers).map(([layer, hunks]) => ({
    id: LayerId.of(layer),
    title: layer,
    summary: layer,
    dependsOn: [],
    ranges: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
    notes: [],
  })),
});

const readying = (steps: ReturnType<typeof checkStepsOf>) =>
  steps.map((step) => [step.id, step.installsAnew] as const);

describe('checkStepsOf, on making the checkout ready', () => {
  it('makes it ready for the whole change, and leaves it alone after', () => {
    const steps = checkStepsOf({
      hunks: ['h1', 'h2', 'h3'].map(HunkId.of),
      facts: facts({}),
      cohorts: [cohort('c1', { 'c1.l1': ['h1'], 'c1.l2': ['h2'] })],
      entries: [],
    });

    expect(readying(steps)).toEqual([
      ['whole', true],
      ['c1.l1', false],
      ['c1.l2', false],
    ]);
  });

  it('makes it ready again for a layer that installs something new', () => {
    const steps = checkStepsOf({
      hunks: ['h1', 'h2', 'h3'].map(HunkId.of),
      facts: facts({ h2: 'lockfile' }),
      cohorts: [
        cohort('c1', { 'c1.l1': ['h1'], 'c1.l2': ['h2'], 'c1.l3': ['h3'] }),
      ],
      entries: [],
    });

    expect(readying(steps)).toEqual([
      ['whole', true],
      // The whole change installed the lockfile. This layer does not have it.
      ['c1.l1', true],
      // This one brings it back.
      ['c1.l2', true],
    ]);
  });

  it('leaves it alone where the lockfile is set aside and every step holds it', () => {
    const steps = checkStepsOf({
      hunks: ['h1', 'h2', 'h3', 'h4'].map(HunkId.of),
      facts: facts({ h4: 'lockfile' }),
      cohorts: [
        cohort('c1', {
          'c1.l1': ['h1'],
          'c1.l2': ['h2'],
          'c1.l3': ['h3'],
        }),
        cohort('c2', { 'c2.l1': ['h4'] }, 'incidental'),
      ],
      entries: [],
    });

    expect(readying(steps)).toEqual([
      ['whole', true],
      ['c1.l1', false],
      ['c1.l2', false],
    ]);
  });
});
