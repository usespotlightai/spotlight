import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { capitalized, chosen, DEFAULT_CHOICE } from '@/lib/agent-choice';

type AgentEffortMenuProps = {
  efforts: readonly string[];
  effort: string;
  onEffort?: (effort: string) => void;
};

export function AgentEffortMenu({
  efforts,
  effort,
  onEffort,
}: AgentEffortMenuProps) {
  if (efforts.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <span className="flex-1">Effort</span>
          <span className="text-muted-foreground">
            {effort ? capitalized(effort) : 'Default'}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent sideOffset={8} className="min-w-44">
          <DropdownMenuRadioGroup
            value={effort || DEFAULT_CHOICE}
            onValueChange={(next) => onEffort?.(chosen(next))}
          >
            <DropdownMenuRadioItem closeOnClick={false} value={DEFAULT_CHOICE}>
              Default
            </DropdownMenuRadioItem>
            {efforts.map((each) => (
              <DropdownMenuRadioItem
                closeOnClick={false}
                key={each}
                value={each}
              >
                {capitalized(each)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
    </>
  );
}
