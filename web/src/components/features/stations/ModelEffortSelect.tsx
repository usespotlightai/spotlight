import { ChevronsUpDown, CodeXml } from 'lucide-react';
import { ModelEffortMenu } from '@/components/features/stations/ModelEffortMenu';
import { ModelEffortSummary } from '@/components/features/stations/ModelEffortSummary';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { cn } from '@/lib/utils';

type ModelEffortSelectProps = {
  harness: string;
  model: string;
  onModel: (model: string) => void;
  effort: string;
  onEffort: (effort: string) => void;
  readOnly?: boolean;
  iconless?: boolean;
  className?: string;
};

export function ModelEffortSelect({
  harness,
  model,
  onModel,
  effort,
  onEffort,
  readOnly = false,
  iconless = false,
  className,
}: ModelEffortSelectProps) {
  const { data: harnesses } = useHarnesses();

  const offered = harnesses?.find((each) => each.id === harness);
  const models = offered?.models ?? [];
  const efforts = offered?.efforts ?? [];
  const modelName =
    models.find((each) => each.id === model)?.name ?? 'Default model';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Model and effort"
        disabled={readOnly || (models.length === 0 && efforts.length === 0)}
        className={cn(
          'flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent disabled:pointer-events-none disabled:opacity-50',
          readOnly && 'disabled:opacity-100',
          className,
        )}
      >
        {!iconless && (
          <CodeXml
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <ModelEffortSummary
          model={model}
          modelName={modelName}
          effort={effort}
          offersEffort={efforts.length > 0}
        />
        {!readOnly && (
          <ChevronsUpDown
            className="ml-auto size-3 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
      </DropdownMenuTrigger>

      <ModelEffortMenu
        models={models}
        model={model}
        onModel={onModel}
        efforts={efforts}
        effort={effort}
        onEffort={onEffort}
      />
    </DropdownMenu>
  );
}
