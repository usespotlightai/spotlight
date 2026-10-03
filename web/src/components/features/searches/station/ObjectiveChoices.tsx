import { ChoiceCard } from '@/components/shared/form/ChoiceCard';
import {
  OBJECTIVE_LABEL,
  objectiveNote,
  objectiveShown,
  type SearchObjective,
} from '@/lib/search-words';

const OBJECTIVES: readonly SearchObjective[] = ['success', 'cost'];

type ObjectiveChoicesProps = {
  value: SearchObjective;
  onChange: (objective: SearchObjective) => void;
  disabled: boolean;
  suggestion: string | null;
};

export function ObjectiveChoices({
  value,
  onChange,
  disabled,
  suggestion,
}: ObjectiveChoicesProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-medium text-foreground text-xs">
        {OBJECTIVE_LABEL}
      </legend>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {OBJECTIVES.map((objective) => (
          <ChoiceCard
            key={objective}
            group="objective"
            value={objective}
            checked={objective === value}
            disabled={disabled}
            onChange={() => onChange(objective)}
            note={objectiveNote(objective)}
          >
            <span className="text-foreground">{objectiveShown(objective)}</span>
          </ChoiceCard>
        ))}
      </div>
      {suggestion && (
        <p
          data-slot="objective-suggestion"
          className="text-muted-foreground text-xs leading-5"
        >
          {suggestion}
        </p>
      )}
    </fieldset>
  );
}
