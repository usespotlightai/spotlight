import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';

type SearchAgentFieldProps = {
  harness: string;
  model: string;
  effort: string;
  problem: string | null;
  readOnly: boolean;
  onHarness: (harness: string) => void;
  onModel: (model: string) => void;
  onEffort: (effort: string) => void;
};

export function SearchAgentField({
  harness,
  model,
  effort,
  problem,
  readOnly,
  onHarness,
  onModel,
  onEffort,
}: SearchAgentFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-foreground text-xs">Its agent</span>
      <div className="-ml-2 flex flex-wrap items-center">
        <HarnessSelect
          value={harness}
          onChange={onHarness}
          allowNone={false}
          readOnly={readOnly}
          className="w-auto"
        />
        <ModelEffortSelect
          harness={harness}
          model={model}
          onModel={onModel}
          effort={effort}
          onEffort={onEffort}
          readOnly={readOnly}
          iconless
          className="w-auto"
        />
      </div>
      {problem && (
        <p role="alert" className="text-destructive text-xs">
          {problem}
        </p>
      )}
    </div>
  );
}
