import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import type { HarnessResponseDto } from '@/lib/api';

type AgentHarnessMenuProps = {
  harnesses: readonly HarnessResponseDto[];
  harness: string;
  onHarness?: (harness: string) => void;
};

export function AgentHarnessMenu({
  harnesses,
  harness,
  onHarness,
}: AgentHarnessMenuProps) {
  const offered = harnesses.find((each) => each.id === harness);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className="flex-1">Harness</span>
        <span className="truncate text-muted-foreground">
          {offered?.name ?? 'No agent'}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={8} className="min-w-52">
        <DropdownMenuRadioGroup
          value={harness}
          onValueChange={(next) => onHarness?.(String(next))}
        >
          {harnesses.map((each) => (
            <DropdownMenuRadioItem
              closeOnClick={false}
              key={each.id}
              value={each.id}
              disabled={!onHarness && each.id !== harness}
            >
              <HarnessLogo harness={each.id} />
              <span className="truncate">{each.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
