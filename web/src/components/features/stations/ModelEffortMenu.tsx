import {
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import type { HarnessModelResponseDto } from '@/lib/api';

const DEFAULT = 'default';

const chosen = (next: unknown) =>
  String(next) === DEFAULT ? '' : String(next);

type ModelEffortMenuProps = {
  models: readonly HarnessModelResponseDto[];
  model: string;
  modelName: string;
  onModel: (model: string) => void;
  efforts: readonly string[];
  effort: string;
  onEffort: (effort: string) => void;
};

export function ModelEffortMenu({
  models,
  model,
  modelName,
  onModel,
  efforts,
  effort,
  onEffort,
}: ModelEffortMenuProps) {
  return (
    <DropdownMenuContent align="start" sideOffset={6} className="min-w-56">
      {efforts.length > 0 && (
        <>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex-1">Effort</span>
              <span className="text-muted-foreground capitalize">
                {effort || 'Default'}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={8} className="min-w-40">
              <DropdownMenuRadioGroup
                value={effort || DEFAULT}
                onValueChange={(next) => onEffort(chosen(next))}
              >
                <DropdownMenuRadioItem value={DEFAULT}>
                  <span className="text-muted-foreground">Default</span>
                </DropdownMenuRadioItem>
                {efforts.map((each) => (
                  <DropdownMenuRadioItem key={each} value={each}>
                    <span className="capitalize">{each}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
        </>
      )}

      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={models.length === 0}>
          <span className="flex-1">Model</span>
          <span className="truncate text-muted-foreground">{modelName}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent sideOffset={8} className="min-w-52">
          <DropdownMenuRadioGroup
            value={model || DEFAULT}
            onValueChange={(next) => onModel(chosen(next))}
          >
            <DropdownMenuRadioItem value={DEFAULT}>
              <span className="text-muted-foreground">Default</span>
            </DropdownMenuRadioItem>
            {models.map((each) => (
              <DropdownMenuRadioItem key={each.id} value={each.id}>
                <span className="truncate">{each.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuContent>
  );
}
