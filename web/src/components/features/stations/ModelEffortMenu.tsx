import { AgentEffortMenu } from '@/components/features/stations/AgentEffortMenu';
import { AgentModelMenu } from '@/components/features/stations/AgentModelMenu';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import type { HarnessModelResponseDto } from '@/lib/api';

type ModelEffortMenuProps = {
  models: readonly HarnessModelResponseDto[];
  model: string;
  onModel: (model: string) => void;
  efforts: readonly string[];
  effort: string;
  onEffort: (effort: string) => void;
};

export function ModelEffortMenu({
  models,
  model,
  onModel,
  efforts,
  effort,
  onEffort,
}: ModelEffortMenuProps) {
  return (
    <DropdownMenuContent align="start" sideOffset={6} className="min-w-56">
      <AgentEffortMenu efforts={efforts} effort={effort} onEffort={onEffort} />
      <AgentModelMenu models={models} model={model} onModel={onModel} />
    </DropdownMenuContent>
  );
}
