import { DiffStat } from '@/components/shared/DiffStat';
import {
  type ChangeStack,
  cohortTallyOf,
  type StackCohort,
} from '@/lib/change-stack';

type CohortTallyProps = {
  stack: ChangeStack;
  cohort: StackCohort;
};

export function CohortTally({ stack, cohort }: CohortTallyProps) {
  const tally = cohortTallyOf(stack, cohort);

  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span>
        {tally.files} {tally.files === 1 ? 'file' : 'files'}
      </span>
      <DiffStat added={tally.added} removed={tally.removed} always />
    </span>
  );
}
