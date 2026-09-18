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

export const checkStepsOf = (input: {
  hunks: readonly HunkId[];
  facts: { isGenerated(hunk: HunkId): boolean };
  cohorts: readonly StackCohort[];
  entries: readonly CheckEntry[];
}): CheckStep[] => {
  const incidental = input.cohorts
    .filter((cohort) => cohort.kind === 'incidental')
    .flatMap((cohort) => cohort.layers)
    .flatMap((layer) => layer.ranges.map((range) => range.hunk))
    .filter((hunk) => !input.facts.isGenerated(hunk));
  const entering = new Map<LayerId, HunkId[]>();

  for (const { hunk, layer } of input.entries) {
    entering.set(layer, [...(entering.get(layer) ?? []), hunk]);
  }
  const whole = [...input.hunks];
  const steps: CheckStep[] = [{ id: WHOLE_STEP, hunks: whole }];

  for (const cohort of input.cohorts) {
    if (cohort.kind !== 'change') {
      continue;
    }

    const placed: HunkId[] = [...incidental];

    for (const layer of cohort.layers) {
      placed.push(
        ...(entering.get(layer.id) ?? []),
        ...layer.ranges.map((range) => range.hunk),
      );

      if (placed.length < whole.length) {
        steps.push({ id: layer.id, hunks: [...placed] });
      }
    }
  }

  return steps;
};
