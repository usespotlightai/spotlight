import { ChevronsUpDown } from 'lucide-react';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { cn } from '@/lib/utils';

const NONE = 'none';

type HarnessSelectProps = {
  value: string;
  onChange: (harness: string) => void;
};

export function HarnessSelect({ value, onChange }: HarnessSelectProps) {
  const { data: harnesses } = useHarnesses();

  const chosen = harnesses?.find((harness) => harness.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Harness"
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <HarnessLogo harness={chosen?.id} />
        <span
          className={cn(
            'truncate',
            chosen ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {chosen?.name ?? 'Nobody'}
        </span>
        <ChevronsUpDown
          className="ml-auto size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-52">
        <DropdownMenuRadioGroup
          value={value || NONE}
          onValueChange={(next) =>
            onChange(String(next) === NONE ? '' : String(next))
          }
        >
          <DropdownMenuRadioItem value={NONE}>
            <span className="truncate text-muted-foreground">Nobody</span>
          </DropdownMenuRadioItem>

          {(harnesses ?? []).map((harness) => (
            <DropdownMenuRadioItem key={harness.id} value={harness.id}>
              <HarnessLogo harness={harness.id} />
              <span className="truncate">{harness.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
