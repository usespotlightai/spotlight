import { SetChoice } from '@/components/features/searches/station/SetChoice';
import type { ReplaySet } from '@/lib/replay';

type SearchSetFieldProps = {
  sets: readonly ReplaySet[];
  setId: string;
  problem: string | null;
  disabled: boolean;
  onChange: (setId: string) => void;
};

export function SearchSetField({
  sets,
  setId,
  problem,
  disabled,
  onChange,
}: SearchSetFieldProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="font-medium text-foreground text-xs mb-1.5">
        Search on
      </legend>
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {sets.map((set) => (
          <SetChoice
            key={set.id}
            set={set}
            checked={set.id === setId}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </div>
      {problem && (
        <p role="alert" className="text-destructive text-xs">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
