import { CountField } from '@/components/features/searches/station/CountField';
import { REPEATS_HINT, REPEATS_LABEL } from '@/lib/replay-words';
import type { BudgetInputs, SearchField } from '@/lib/search';

type SearchBudgetCountsProps = {
  inputs: BudgetInputs;
  problemOf: (field: SearchField) => string | null;
  disabled: boolean;
  onChange: (field: keyof BudgetInputs) => (value: string) => void;
};

export function SearchBudgetCounts({
  inputs,
  problemOf,
  disabled,
  onChange,
}: SearchBudgetCountsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <CountField
        label="Iterations"
        hint="Times the search agent runs, 1 to 10."
        value={inputs.iterations}
        problem={problemOf('iterations')}
        disabled={disabled}
        onChange={onChange('iterations')}
      />
      <CountField
        label="Candidates per iteration"
        hint="Candidates each agent run may propose, 1 to 5."
        value={inputs.perIteration}
        problem={problemOf('perIteration')}
        disabled={disabled}
        onChange={onChange('perIteration')}
      />
      <CountField
        label="At once"
        hint="Replay runs at the same time, 1 to 10."
        value={inputs.concurrency}
        problem={problemOf('concurrency')}
        disabled={disabled}
        onChange={onChange('concurrency')}
      />
      <CountField
        label={REPEATS_LABEL}
        hint={REPEATS_HINT}
        value={inputs.repeats}
        problem={problemOf('repeats')}
        disabled={disabled}
        onChange={onChange('repeats')}
      />
    </div>
  );
}
