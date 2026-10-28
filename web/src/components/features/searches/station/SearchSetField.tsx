import { SetChoice } from '@/components/features/searches/station/SetChoice';
import { ScrollArea } from '@/components/ui/scroll-area';
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
      <ScrollArea className="max-h-48" contentClassName="flex flex-col gap-1">
        {sets.map((set) => (
          <SetChoice
            key={set.id}
            set={set}
            checked={set.id === setId}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </ScrollArea>
      {problem && (
        <p role="alert" className="text-destructive text-xs">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
