import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { chosen, DEFAULT_CHOICE } from '@/lib/agent-choice';
import type { HarnessModelResponseDto } from '@/lib/api';

type AgentModelMenuProps = {
  models: readonly HarnessModelResponseDto[];
  model: string;
  onModel?: (model: string) => void;
};

export function AgentModelMenu({
  models,
  model,
  onModel,
}: AgentModelMenuProps) {
  const modelName = models.find((each) => each.id === model)?.name;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={models.length === 0}>
        <span className="flex-1">Model</span>
        <span className="truncate text-muted-foreground">
          {modelName ?? 'Default'}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={8} className="min-w-52">
        <DropdownMenuRadioGroup
          value={model || DEFAULT_CHOICE}
          onValueChange={(next) => onModel?.(chosen(next))}
        >
          <DropdownMenuRadioItem closeOnClick={false} value={DEFAULT_CHOICE}>
            Default
          </DropdownMenuRadioItem>
          {models.map((each) => (
            <DropdownMenuRadioItem
              closeOnClick={false}
              key={each.id}
              value={each.id}
            >
              <span className="truncate">{each.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
