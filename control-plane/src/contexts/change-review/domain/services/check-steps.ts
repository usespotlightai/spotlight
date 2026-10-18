import type { FileClass } from '@change-review/domain/services/diff-facts';
import type {
  CheckEntry,
  CheckStep,
} from '@change-review/domain/value-objects/stack-check.vo';
import { WHOLE_STEP } from '@change-review/domain/value-objects/stack-check.vo';
import type { StackCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type {
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';

interface StepFacts {
  isGenerated(hunk: HunkId): boolean;
  classOf(hunk: HunkId): FileClass | null;
}

const sameSet = (left: ReadonlySet<string>, right: ReadonlySet<string>) =>
  left.size === right.size && [...left].every((each) => right.has(each));

const readying = (
  steps: readonly Omit<CheckStep, 'runsSetup'>[],
  facts: StepFacts,
): CheckStep[] => {
  let installed: ReadonlySet<string> = new Set();

  return steps.map((step, at) => {
    const locks = new Set(
      step.hunks.filter((hunk) => facts.classOf(hunk) === 'lockfile'),
    );
    const again = at === 0 || !sameSet(locks, installed);
    installed = locks;

    return { ...step, runsSetup: again };
  });
};

export const checkStepsOf = (input: {
  hunks: readonly HunkId[];
  facts: StepFacts;
  cohorts: readonly StackCohort[];
  entries: readonly CheckEntry[];
}): CheckStep[] => {
  const incidental = input.cohorts
    .filter((cohort) => cohort.kind === 'incidental')
    .flatMap((cohort) => cohort.layers)
    .flatMap((layer) => layer.hunks.map((entry) => entry.hunk))
    .filter((hunk) => !input.facts.isGenerated(hunk));
  const entering = new Map<LayerId, HunkId[]>();

  for (const { hunk, layer } of input.entries) {
    entering.set(layer, [...(entering.get(layer) ?? []), hunk]);
  }
  const whole = [...input.hunks];
  const steps: Omit<CheckStep, 'runsSetup'>[] = [
    { id: WHOLE_STEP, hunks: whole, stopsOnFailure: true },
  ];

  for (const cohort of input.cohorts) {
    if (cohort.kind !== 'change') {
      continue;
    }

    const assigned: HunkId[] = [...incidental];

    for (const layer of cohort.layers) {
      assigned.push(
        ...(entering.get(layer.id) ?? []),
        ...layer.hunks.map((entry) => entry.hunk),
      );

      if (assigned.length < whole.length) {
        steps.push({
          id: layer.id,
          hunks: [...assigned],
          stopsOnFailure: false,
        });
      }
    }
  }

  return readying(steps, input.facts);
};
