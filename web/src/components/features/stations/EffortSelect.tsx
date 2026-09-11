import { ChevronsUpDown, Gauge } from 'lucide-react';
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

type EffortSelectProps = {
  /** The harness whose effort ladder is on offer. */
  harness: string;
  value: string;
  onChange: (effort: string) => void;
};

/** "Default" leaves the harness to decide; hidden where it offers no efforts. */
export function EffortSelect({ harness, value, onChange }: EffortSelectProps) {
  const { data: harnesses } = useHarnesses();

  const efforts = harnesses?.find((each) => each.id === harness)?.efforts ?? [];

  if (efforts.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Effort"
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <Gauge
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span
          className={cn(
            'truncate',
            value ? 'capitalize' : 'text-muted-foreground',
          )}
        >
          {value || 'Default effort'}
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
            <span className="truncate text-muted-foreground">Default</span>
          </DropdownMenuRadioItem>

          {efforts.map((effort) => (
            <DropdownMenuRadioItem key={effort} value={effort}>
              <span className="truncate capitalize">{effort}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
